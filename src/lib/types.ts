export interface client_server {
	"create"(player_name: string, room_password: string, admin_password: string): void
	"join"(room_id: string, player_name: string, password: string, admin: boolean): void
	"role"(name: string, role: "admin" | "seeker" | "hider"): void
}

export interface server_client {
	"create"(room_id: string): void
	"join"(room_id: string): void
	"role"(role: "admin" | "seeker" | "hider"): void
	"players"(players: player[]): void

	"error"(error: string): void
}

export type player = {
	name: string
	role?: "admin" | "seeker" | "hider"
}
