import type http from "http"
import type { Http2SecureServer } from "http2"
import { Server } from "socket.io"
import type { client_server, player, server_client } from "./types"

export default function (server: http.Server | Http2SecureServer) {
	const io = new Server<client_server, server_client, Record<string, never>>(server)

	const room_ids = Array.from({ length: 899 }, (_, i) => (i + 100).toString())
	const rooms: Room[] = []

	io.on("connection", (socket) => {
		let room: Room | undefined
		socket.on("create", (name, room_password, admin_password) => {
			const id = random(room_ids)

			rooms.push({ id, room_password, admin_password, players: [{ name, role: "admin" }] })
			socket.emit("create", id)
		})

		socket.on("join", (id, name, password, admin) => {
			const candidate_room = rooms.find((room) => room.id === id)
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
						break
					case "seeker":
						socket.emit("role", "seeker")
						break
					case "hider":
						socket.emit("role", "hider")
						break
				}
			} else {
				room.players.push({ role: admin ? "admin" : undefined, name })
				io.to(id).emit("players", room.players)
			}

			socket.join(id)
			socket.emit("join", id)
			if (admin) socket.emit("role", "admin")
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
