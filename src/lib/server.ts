import type http from "http"
import type { Http2SecureServer } from "http2"
import { Server } from "socket.io"
import type { client_server, data, player, server_client } from "./types"

export default function (server: http.Server | Http2SecureServer) {
	const io = new Server<client_server, server_client, Record<string, never>, data>(server)

	const room_ids = Array.from({ length: 899 }, (_, i) => (i + 100).toString())
	const rooms: Room[] = []

	io.on("connection", (socket) => {
		let room: Room | undefined
		socket.on("create", (name, room_password, admin_password) => {
			const id = random(room_ids)

			rooms.push({ id, room_password, admin_password, players: [{ name, role: "admin" }] })
			socket.emit("create", id)
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
					default:
						socket.emit("join", room_id)
				}
			} else {
				room.players.push({ role: admin ? "admin" : undefined, name })
				io.to(room_id).emit("players", room.players)
			}

			socket.emit("join", room_id)
			if (admin) socket.emit("role", "admin")
			socket.data.name = name
			socket.join(room_id)
			socket.join(`${room_id}-${name}`)
		})

		socket.on("role", (name, role) => {
			if (!room) return

			const candidate_player = room.players.find((player) => player.name === name)
			if (!candidate_player) return

			candidate_player.role = role

			io.to(`${room.id}-${name}`).emit("role", role)

			io.to(candidate_player.role).emit("players", room.players)
		})

		socket.on("gps", (coords) => {
			if (!room) return

			const candidate_player = room?.players.find((player) => player.name === socket.data.name)
			if (!candidate_player || candidate_player.role !== "seeker") return

			io.to(`${room.id}-hider`).emit("gps", socket.data.name, coords)
		})
	})
}

type Room = {
	id: string
	room_password: string
	admin_password: string
	players: player[]
}

function random<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())]
}
