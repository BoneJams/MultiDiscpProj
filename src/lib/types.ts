export interface client_server {
	"create"(player_name: string, room_password: string, admin_password: string): void
	"join"(room_id: string, player_name: string, password: string, admin: boolean): void
	"role"(name: string, role: "admin" | "seeker" | "hider"): void
	"gps"(coords: GeolocationCoordinates): void
	"radar"(meters: number, coords: GeolocationCoordinates): void
}

export interface server_client {
	"create"(room_id: string): void
	"join"(room_id: string): void
	"role"(role: "admin" | "seeker" | "hider"): void
	"players"(players: player[]): void
	"gps"(name: string, coords: GeolocationCoordinates): void
	"coins"(coins: number): void
	"radar"(meters: number, inside?: boolean): void

	"error"(error: string): void
}

export interface data {
	name: string
}

export type player = {
	name: string
	role?: "admin" | "seeker" | "hider"
}
