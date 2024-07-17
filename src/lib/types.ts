import type { dice_curses, task_categories } from "./const"

export interface client_server {
	"create"(player_name: string, room_password: string, admin_password: string): void
	"join"(room_id: string, player_name: string, password: string, admin: boolean): void
	"role"(name: string, role: "admin" | "seeker" | "hider"): void
	"task"(task: keyof typeof task_categories, state: "requested" | "completed" | "confirmed"): void
	"dice"(number_of_dices: string): void
	"curse"(
		curse: keyof typeof dice_curses,
		dices: number[],
		state: "requested" | "completed" | "confirmed"
	): void
	"gps"(coords: GeolocationCoordinates): void

	"coins"(coins: number): void
}

export interface server_client {
	"create"(room_id: string): void
	"join"(room_id: string): void
	"players"(players: player[]): void
	"coins"(coins: number): void
	"task"(
		task: keyof typeof task_categories,
		state: "requested" | "completed" | "confirmed",
		result?: string
	): void
	"curse"(
		curse: keyof typeof dice_curses,
		dices: number[],
		state: "requested" | "completed" | "confirmed"
	): void
	"gps"(name: string, coords: GeolocationCoordinates): void
	"error"(error: string): void
}

export interface data {
	name: string
}

export type player = {
	name: string
	role?: "admin" | "seeker" | "hider"
}
