import type http from "http"
import type { Http2SecureServer } from "http2"
import { Server, Socket } from "socket.io"
import {
	category_coins,
	dice_coins,
	radar_meters,
	radars,
	task_categories,
	task_names,
	type dice_curses
} from "../const"
import type { client_server, curse, data, Room, server_client, task } from "../types"

export default function (server: http.Server | Http2SecureServer) {
	const io = new Server<client_server, server_client, Record<string, never>, data>(server)

	const room_ids = Array.from({ length: 899 }, (_, i) => (i + 100).toString())
	const rooms: Room[] = []
	const connected_clients = new Array(1000).fill(0)

	io.on("connection", (socket) => {
		let room: Room | undefined
		socket.on("create", (name, room_password, admin_password) => {
			const id = random(room_ids)

			rooms.push({
				id,
				room_password,
				admin_password,
				players: [{ name, role: "admin", banned: false, disconnected: false }],
				coins: 0,
				curses: [],
				tasks: [],
				game: "waiting",
				found: "none"
			})

			socket.emit("create", id)

			sockets[id] = {}
		})

		socket.on("join", (room_id, name, password, admin) => {
			const candidate_room = rooms.find((room) => room.id === room_id)
			if (!candidate_room) {
				socket.emit("error", "Room not found")
				return
			}

			if (password !== (admin ? candidate_room.admin_password : candidate_room.room_password))
				return socket.emit("error", "Wrong password")

			let candidate_player = candidate_room.players.find((player) => player.name === name)

			if (candidate_player && candidate_player.banned) return socket.emit("banned")

			if (candidate_player) {
				if (candidate_player.role === "admin" && !admin)
					return socket.emit(
						"error",
						"If you are an admin please log in as admin. If you are not an admin, please choose another name."
					)
				if (candidate_player.role !== "admin" && admin)
					return socket.emit(
						"error",
						"If you are an admin, please choose another name. If you are not an admin, turn off join as admin."
					)

				candidate_player.disconnected = false
			} else {
				candidate_player = {
					role: admin ? "admin" : "none",
					name,
					banned: false,
					disconnected: false
				}
				candidate_room.players.push(candidate_player)
			}

			// * Passed all checks, join the room

			room = candidate_room
			socket.join(room_id)
			socket.emit("join", room_id)

			socket.data.name = name
			sockets[room_id][name] = socket
			connected_clients[parseInt(room_id)] += 1

			// * Sync room data to the client
			socket.emit("coins", room.coins)
			room.tasks.forEach((task) => socket.emit("task", task, true))
			room.curses.forEach((curse) => socket.emit("curse", curse, true))
			socket.emit("game", room.game)
			if (room.started_at) socket.emit("started", room.started_at)
			if (room.ended_at) socket.emit("ended", room.ended_at)

			// * Sync room data to all clients
			io.to(room_id).emit("players", room.players)
		})

		socket.on("gps", (coords) => {
			if (!room) return

			const candidate_player = room?.players.find((player) => player.name === socket.data.name)

			if (!candidate_player) return

			candidate_player.coords = coords

			io.to(room.id).emit("players", room.players)
		})

		socket.on("task", (task) => {
			if (!room) return

			if (task.state === "requested" && room.curses.some((curse) => curse.state !== "confirmed")) {
				return socket.emit(
					"error",
					"You need to complete all your curses first before you can send tasks"
				)
			}

			if (task.state === "requested" && room.tasks.some((task) => task.state !== "confirmed")) {
				return socket.emit("error", "You can only send one task at a time")
			}

			if (room.tasks.some((_task) => task.task === _task.task))
				return socket.emit("error", "You cannot request the same task more than once")

			if (radars.includes(task.task as (typeof radars)[number])) {
				const seeker_coords = room.players.find(
					(player) => player.name === socket.data.name
				)?.coords

				if (!seeker_coords)
					return socket.emit(
						"error",
						"The system has not receive your gps. Please try again later."
					)

				const hiders_coords = room.players
					.filter((player) => player.role === "hider" && !player.disconnected)
					.map((player) => player.coords)
					.filter((coords) => coords !== undefined)

				if (!hiders_coords.length)
					return socket.emit(
						"error",
						"The system has not receive the gps of at least one hider. Please try again later."
					)

				let inside = 0

				for (const hider_coords of hiders_coords) {
					const distance = measure(hider_coords, seeker_coords)
					if (distance < radar_meters[task.task as (typeof radars)[number]]) {
						inside += 1
					}
				}

				const new_task: task = {
					task: task.task,
					state: "confirmed",
					result: `${inside} hiders are inside the seeker ${socket.data.name}'s ${task_names[task.task]}`
				}

				room.tasks.push(new_task)
				room.coins += category_coins[task_categories[task.task]]

				io.to(room.id).emit("task", new_task, true)
				io.to(room.id).emit("coins", room.coins)
			} else {
				io.to(room.id).emit("task", task)

				if (task.state !== "requested") room.tasks.pop()
				room.tasks.push(task)

				if (task.state === "confirmed") {
					room.coins += category_coins[task_categories[task.task]]
					io.to(room.id).emit("coins", room.coins)
				}
			}
		})

		socket.on("dice", (number_of_dices_str) => {
			if (!room) return

			const number_of_dices = parseInt(number_of_dices_str)
			if (isNaN(number_of_dices) || number_of_dices <= 0)
				return socket.emit("error", "Invalid number of dices")

			if (number_of_dices * dice_coins > room.coins) {
				return socket.emit(
					"error",
					`You do not have enough coins to roll that many dices (1 dice cost 50 coins). The maximum dices you can roll is ${Math.floor(room.coins / dice_coins)}`
				)
			}

			if (room.tasks.some((task) => task.state !== "confirmed")) {
				return socket.emit(
					"error",
					"You need to complete all your tasks first before you can send curses"
				)
			}

			if (room.curses.some((curse) => curse.state !== "confirmed")) {
				return socket.emit("error", "You can only send one curse at a time")
			}

			const dices: number[] = []
			let raw = 0
			for (let i = 0; i < number_of_dices; i++) {
				const dice = Math.floor(Math.random() * 6) + 1
				dices.push(dice)
				raw += dice
			}
			const curse = raw > 24 ? 24 : (raw as keyof typeof dice_curses)

			const new_curse: curse = { dices, curse, state: "requested" }

			io.to(room.id).emit("curse", new_curse)
			room.coins -= number_of_dices * dice_coins
			io.to(room.id).emit("coins", room.coins)
			room.curses.push(new_curse)
		})

		socket.on("curse", (curse) => {
			if (!room) return
			io.to(room.id).emit("curse", curse)
			if (curse.state !== "requested") room.curses.pop()
			room.curses.push(curse)
		})

		socket.on("coins", (coins) => {
			if (!room) return
			room.coins = coins
			io.to(room.id).emit("coins", coins)
		})

		socket.on("game", (state) => {
			if (!room) return
			room.game = state
			io.to(room.id).emit("game", state)
			if (state === "ingame") {
				room.started_at = Date.now()
				room.ended_at = undefined
				io.to(room.id).emit("started", room.started_at)
				room.players.forEach((player) => {
					if (!room) return
					if (player.coords) player.start_coords = player.coords
				})
			} else if (state === "ended") {
				room.ended_at = Date.now()
				io.to(room.id).emit("ended", room.ended_at)
			}
		})

		socket.on("players", (players) => {
			if (!room) return
			room.players = players
			room.players.forEach((player) => {
				if (!room) return
				if (player.banned) sockets[room.id][player.name]?.emit("banned")
			})
			io.to(room.id).emit("players", room.players)
		})

		socket.on("found", () => {
			if (!room) return
			const candidate_player = room.players.find((player) => player.name === socket.data.name)
			if (!candidate_player) return

			switch (candidate_player.role) {
				case "seeker":
					if (room.found === "hider") room.found = "both"
					else room.found = "seeker"
					break
				case "hider":
					if (room.found === "seeker") room.found = "both"
					else room.found = "hider"
					break
			}

			if (room.found === "both") {
				room.game = "ended"
				io.to(room.id).emit("game", "ended")
				room.ended_at = Date.now()
				io.to(room.id).emit("ended", room.ended_at)
			}

			io.to(room.id).emit("found", room.found)
		})

		socket.on("disconnecting", () => {
			if (!room) return

			connected_clients[parseInt(room.id)] -= 1
			if (connected_clients[parseInt(room.id)] > 0) return
			room_ids.push(room.id)
			const index = rooms.findIndex(({ id }) => id === room?.id)
			if (index === -1) return
			rooms.splice(index, 1)

			const candidate_player = room.players.find((player) => player.name === socket.data.name)
			if (!candidate_player) return
			candidate_player.disconnected = true

			io.to(room.id).emit("players", room.players)
		})
	})
}

function random<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())]
}

const sockets: Record<
	string,
	Record<string, Socket<client_server, server_client, Record<string, never>, data>>
> = {}

/**
 * * Generally used geo measurement function
 * https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
 */
export function measure(
	{ latitude: lat1, longitude: lon1 }: { latitude: number; longitude: number },
	{ latitude: lat2, longitude: lon2 }: { latitude: number; longitude: number }
) {
	const R = 6378.137 // Radius of earth in KM
	const dLat = (lat2 * Math.PI) / 180 - (lat1 * Math.PI) / 180
	const dLon = (lon2 * Math.PI) / 180 - (lon1 * Math.PI) / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	const d = R * c
	return d * 1000 // meters
}
