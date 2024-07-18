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
	"game"(state: "undefined" | "started" | "ended" | "aborted"): void
	"ban"(name: string, banned: boolean): void
	"end"(): void

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
		result?: string,
		persist?: true
	): void
	"curse"(
		curse: keyof typeof dice_curses,
		dices: number[],
		state: "requested" | "completed" | "confirmed",
		persist?: true
	): void
	"gps"(name: string, coords: GeolocationCoordinates, hider?: true): void
	"game"(state: "undefined" | "started" | "ended" | "aborted"): void
	"ban"(): void
	"end"(state: undefined | "hider" | "seeker" | "both"): void
	"start"(ms: number): void
	"time"(ms: number): void

	"error"(error: string): void
}

export interface data {
	name: string
}

export type player = {
	name: string
	role?: "admin" | "seeker" | "hider"
	banned: boolean
}
