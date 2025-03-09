import type { dice_curses, task_categories } from './const';

export interface client_server {
	create(player_name: string, room_password: string, admin_password: string): void;
	join(room_id: string, player_name: string, password: string, admin: boolean): void;

	players(players: player[]): void;
	coins(coins: number): void;

	task(task: task): void;

	dice(number_of_dices: string): void;

	curse(curse: curse): void;

	game(state: game_state): void;
	found(): void;

	gps(coords: GeolocationCoordinates): void;
}

export interface server_client {
	create(room_id: string): void;
	join(room_id: string): void;

	players(players: player[]): void;
	coins(coins: number): void;

	task(task: task, new_task?: true): void;
	curse(curse: curse, new_curse?: true): void;

	game(state: game_state, previous?: game_state): void;

	banned(): void;

	found(state: found_state): void;

	started(started_at: number): void;
	ended(ended_at: number): void;

	error(error: string): void;
}

export interface data {
	name: string;
}

export type player = {
	name: string;
	role: 'none' | 'admin' | 'seeker' | 'hider';
	banned: boolean;
	coords?: GeolocationCoordinates;
	start_coords?: GeolocationCoordinates;
	disconnected: boolean;
};

export type valueof<T> = T[keyof T];

export type task = {
	task: keyof typeof task_categories;
	state: 'requested' | 'completed' | 'confirmed';
	result?: string;
	old?: true;
};
export type curse = {
	dices: number[];
	curse: keyof typeof dice_curses;
	state: 'requested' | 'completed' | 'confirmed';
	old?: true;
};

export type game_state = 'waiting' | 'ingame' | 'paused' | 'ended' | 'aborted';
export type found_state = 'none' | 'hider' | 'seeker' | 'both';

export type Room = {
	id: string;
	room_password: string;
	admin_password: string;
	players: player[];
	coins: number;

	tasks: task[];
	curses: curse[];

	game: game_state;
	found: found_state;

	started_at?: number;
	ended_at?: number;
};
