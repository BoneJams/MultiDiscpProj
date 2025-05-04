import { z } from 'zod';
import { dice_curses, task_categories } from './const';

const coords_schema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	accuracy: z.number()
});

const player_schema = z.object({
	name: z.string(),
	role: z.enum(['none', 'admin', 'seeker', 'hider']),
	banned: z.boolean(),
	disconnected: z.boolean(),
	coords: coords_schema.optional(),
	start_coords: coords_schema.optional()
});

export type player = z.infer<typeof player_schema>;

const task_schema = z.object({
	task: z.enum(
		Object.keys(task_categories) as [
			keyof typeof task_categories,
			...(keyof typeof task_categories)[]
		]
	),
	state: z.enum(['requested', 'completed', 'confirmed']),
	result: z.string().optional(),
	old: z.boolean().optional()
});

export type task = z.infer<typeof task_schema>;

const curse_schema = z.object({
	dices: z.array(z.number()),
	curse: z.enum(
		Object.keys(dice_curses) as [keyof typeof dice_curses, ...(keyof typeof dice_curses)[]]
	),
	state: z.enum(['requested', 'completed', 'confirmed']),
	old: z.boolean().optional()
});

export type curse = z.infer<typeof curse_schema>;

const game_state_schema = z.enum(['waiting', 'ingame', 'paused', 'ended', 'aborted']);

export type game_state = z.infer<typeof game_state_schema>;

const found_state_schema = z.enum(['none', 'hider', 'seeker', 'both']);

export type found_state = z.infer<typeof found_state_schema>;

export const client_server = z.discriminatedUnion('ev', [
	z.object({
		ev: z.literal('create'),
		player_name: z.string(),
		room_password: z.string(),
		admin_password: z.string()
	}),

	z.object({
		ev: z.literal('join'),
		room_id: z.string(),
		player_name: z.string(),
		password: z.string(),
		admin: z.boolean()
	}),

	z.object({ ev: z.literal('players'), players: z.array(player_schema) }),
	z.object({ ev: z.literal('coins'), coins: z.number() }),

	z.object({ ev: z.literal('task'), task: task_schema }),
	z.object({ ev: z.literal('dice'), number_of_dices: z.string() }),
	z.object({ ev: z.literal('curse'), curse: curse_schema }),

	z.object({ ev: z.literal('game'), state: game_state_schema }),
	z.object({ ev: z.literal('found') }),

	z.object({ ev: z.literal('gps'), coords: coords_schema })
]);

export const server_client = z.discriminatedUnion('ev', [
	z.object({ ev: z.literal('create'), room_id: z.string() }),
	z.object({ ev: z.literal('join'), room_id: z.string() }),

	z.object({ ev: z.literal('players'), players: z.array(player_schema) }),
	z.object({ ev: z.literal('coins'), coins: z.number() }),

	z.object({ ev: z.literal('task'), task: task_schema, new_task: z.boolean() }),
	z.object({ ev: z.literal('curse'), curse: curse_schema, new_curse: z.boolean() }),

	z.object({ ev: z.literal('game'), state: game_state_schema, previous: game_state_schema }),
	z.object({ ev: z.literal('banned') }),
	z.object({ ev: z.literal('found'), found: found_state_schema }),

	z.object({ ev: z.literal('started'), started_at: z.number() }),
	z.object({ ev: z.literal('ended'), ended_at: z.number() }),

	z.object({ ev: z.literal('gps'), name: z.string(), coords: coords_schema }),

	z.object({ ev: z.literal('error'), error: z.string() })
]);

export type valueof<T> = T[keyof T];

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
