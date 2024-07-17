import type http from "http"
import type { Http2SecureServer } from "http2"
import { Server, Socket } from "socket.io"
import {
	category_coins,
	dice_coins,
	radar_meters,
	radars,
	task_categories,
	type dice_curses
} from "./const"
import type { client_server, data, player, server_client } from "./types"

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
				players: [{ name, role: "admin" }],
				coins: 0,
				curses: [],
				tasks: []
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

			room = candidate_room

			if (password !== (admin ? room.admin_password : room.room_password))
				return socket.emit("error", "Wrong password")

			const candidate_player = room.players.find((player) => player.name === name)

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

				switch (candidate_player.role) {
					case "admin":
						socket.join(`${room.id}-admin`)
						break
					case "seeker":
						socket.join(`${room.id}-seeker`)
						break
					case "hider":
						socket.join(`${room.id}-hider`)
						break
				}
			} else {
				room.players.push({ role: admin ? "admin" : undefined, name })
			}

			socket.emit("join", room_id)
			socket.join(room_id)
			socket.data.name = name

			io.to(room_id).emit("players", room.players)

			socket.emit("coins", room.coins)

			room.curses.forEach(
				(curse) => socket.emit("curse", curse.curse, curse.dices, curse.state),
				true
			)
			room.tasks.forEach((task) => socket.emit("task", task.task, task.state), true)

			if (room.seeker && room.seeker_coords) socket.emit("gps", room.seeker, room.seeker_coords)

			sockets[room_id][name] = socket

			connected_clients[parseInt(room_id)] += 1
		})

		socket.on("role", (name, role) => {
			if (!room) return

			const candidate_player = room.players.find((player) => player.name === name)
			if (!candidate_player) return

			sockets[room.id]?.[name]?.leave(`${room.id}-${candidate_player.role}`)
			sockets[room.id]?.[name]?.join(`${room.id}-${role}`)

			candidate_player.role = role

			io.to(room.id).emit("players", room.players)
		})

		socket.on("gps", (coords) => {
			if (!room) return

			const candidate_player = room?.players.find((player) => player.name === socket.data.name)

			if (!candidate_player) return

			switch (candidate_player.role) {
				case "seeker":
					room.seeker = socket.data.name
					room.seeker_coords = coords
					io.to(room.id).emit("gps", socket.data.name, coords)
					break
				case "hider":
					room.hider_coords = coords
					io.to(`${room.id}-admin`).emit("gps", socket.data.name, coords, true)
					io.to(`${room.id}-hider`).emit("gps", socket.data.name, coords, true)
					break
			}
		})

		socket.on("task", (task, state) => {
			if (!room) return

			if (state === "requested" && room.curses.some((curse) => curse.state !== "confirmed")) {
				return socket.emit(
					"error",
					"You need to complete all your curses first before you can send tasks"
				)
			}

			if (state === "requested" && room.tasks.some((task) => task.state !== "confirmed")) {
				return socket.emit("error", "You can only send one task at a time")
			}

			if (radars.includes(task as (typeof radars)[number])) {
				if (!room.hider_coords || !room.seeker_coords)
					return socket.emit("error", "Hider or Seeker not found")

				io.to(room.id).emit("task", task, "requested")

				const distance = measure(room.hider_coords, room.seeker_coords)

				io.to(room.id).emit(
					"task",
					task,
					"confirmed",
					distance < radar_meters[task as (typeof radars)[number]] ? "inside" : "outside"
				)
				room.coins += category_coins[task_categories[task]]
				io.to(room.id).emit("coins", room.coins)
				socket.emit("coins", room.coins)
				room.tasks.push({
					task,
					state: "confirmed",
					result: distance < radar_meters[task as (typeof radars)[number]] ? "inside" : "outside"
				})
			} else {
				io.to(room.id).emit("task", task, state)
				if (state !== "requested") room.tasks.pop()
				room.tasks.push({ task, state })
				if (state === "confirmed") {
					room.coins += category_coins[task_categories[task]]
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
					`You do not have enough coins to roll that many dices. The maximum dices you can roll is ${Math.floor(room.coins / dice_coins)}`
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
			io.to(room.id).emit("curse", curse, dices, "requested")
			room.coins -= number_of_dices * dice_coins
			io.to(room.id).emit("coins", room.coins)
			room.curses.push({ curse, dices, state: "requested" })
		})

		socket.on("curse", (curse, dices, state) => {
			if (!room) return
			io.to(room.id).emit("curse", curse, dices, state)
			if (state !== "requested") room.curses.pop()
			room.curses.push({ curse, dices, state })
		})

		socket.on("coins", (coins) => {
			if (!room) return
			room.coins = coins
			io.to(room.id).emit("coins", coins)
		})

		socket.on("disconnecting", () => {
			if (!room) return

			connected_clients[parseInt(room.id)] -= 1
			if (connected_clients[parseInt(room.id)] > 0) return
			room_ids.push(room.id)
			const index = rooms.findIndex(({ id }) => id === room?.id)
			if (index === -1) return
			rooms.splice(index, 1)
		})
	})
}

type Room = {
	id: string
	room_password: string
	admin_password: string
	players: player[]
	coins: number
	seeker_coords?: GeolocationCoordinates
	seeker?: string
	hider_coords?: GeolocationCoordinates
	curses: {
		dices: number[]
		curse: keyof typeof dice_curses
		state: "requested" | "completed" | "confirmed"
	}[]
	tasks: {
		task: keyof typeof task_categories
		state: "requested" | "completed" | "confirmed"
		result?: string
	}[]
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
