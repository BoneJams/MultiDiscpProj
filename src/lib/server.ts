import type http from "http"
import type { Http2SecureServer } from "http2"
import { Server, Socket } from "socket.io"
import type { client_server, data, player, server_client } from "./types"

export default function (server: http.Server | Http2SecureServer) {
	const io = new Server<client_server, server_client, Record<string, never>, data>(server)

	const room_ids = Array.from({ length: 899 }, (_, i) => (i + 100).toString())
	const rooms: Room[] = []

	io.on("connection", (socket) => {
		let room: Room | undefined
		socket.on("create", (name, room_password, admin_password) => {
			const id = random(room_ids)

			rooms.push({
				id,
				room_password,
				admin_password,
				players: [{ name, role: "admin" }],
				coins: 0
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

			if (admin ? password !== room.admin_password : password !== room.room_password)
				return socket.emit("error", "Wrong password")

			const candidate_player = room.players.find((player) => player.name === name)

			if (candidate_player) {
				if (candidate_player.role === "admin" && !admin)
					return socket.emit(
						"error",
						"If you are an admin please log in as admin. If you are not an admin, please choose another name."
					)
				if (candidate_player.role !== "admin" && admin)
					return socket.emit("error", "You are not an admin.")

				socket.emit("players", room.players)

				socket.emit("join", room_id)

				switch (candidate_player.role) {
					case "admin":
						socket.emit("role", "admin")
						socket.join(`${room.id}-admin`)
						break
					case "seeker":
						socket.emit("role", "seeker")
						socket.join(`${room.id}-seeker`)
						break
					case "hider":
						socket.emit("role", "hider")
						socket.join(`${room.id}-hider`)
						break
				}
			} else {
				socket.emit("join", room_id)

				room.players.push({ role: admin ? "admin" : undefined, name })
				io.to(room_id).emit("players", room.players)
			}

			if (admin) socket.emit("role", "admin")

			socket.data.name = name
			socket.join(room_id)

			sockets[room_id][name] = socket
		})

		socket.on("role", (name, role) => {
			if (!room) return

			const candidate_player = room.players.find((player) => player.name === name)
			if (!candidate_player) return

			sockets[room.id]?.[name]?.leave(`${room.id}-${candidate_player.role}`)
			sockets[room.id]?.[name]?.join(`${room.id}-${role}`)
			sockets[room.id]?.[name]?.emit("role", role)

			candidate_player.role = role

			io.to(room.id).emit("players", room.players)
		})

		socket.on("gps", (coords) => {
			if (!room) return

			const candidate_player = room?.players.find((player) => player.name === socket.data.name)
			if (!candidate_player || candidate_player.role !== "seeker") return

			io.to(`${room.id}-hider`).emit("gps", socket.data.name, coords)
		})

		socket.on("radar", (meters, coords) => {
			if (!room) return

			const candidate_player = room?.players.find((player) => player.name === socket.data.name)
			if (!candidate_player) return

			if (candidate_player.role === "seeker") {
				io.to(`${room.id}-hider`).emit("radar", meters)
				room.seeker_coords = coords
			}

			if (candidate_player.role === "hider") {
				room.hider_coords = coords

				if (!room.seeker_coords) return

				const distance = measure(coords, room.seeker_coords)

				io.to(room.id).emit("radar", meters, distance < meters)

				room.coins += 40

				io.to(room.id).emit("coins", room.coins)
			}
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
	hider_coords?: GeolocationCoordinates
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
