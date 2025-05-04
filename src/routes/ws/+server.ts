import { publish } from '$app/server';
import {
	category_coins,
	dice_coins,
	dice_curses,
	radar_meters,
	radars,
	task_categories
} from '$lib/const';
import { client_server, server_client, type curse, type Room, type task } from '$lib/types';
import { pack, unpack } from 'msgpackr';
import type { z } from 'zod';
import type { Peer, Socket } from './$types';

const room_ids = Array.from({ length: 899 }, (_, i) => (i + 100).toString());
const rooms: Room[] = [];
const connected_clients = new Array(1000).fill(0);

export const socket: Socket = {
	open(peer) {
		peer.websocket.binaryType = 'arraybuffer';
	},
	message(peer, message) {
		try {
			const data = client_server.parse(unpack(Buffer.from(message.data as ArrayBuffer)));
			switch (data.ev) {
				case 'create': {
					const id = random(room_ids);

					rooms.push({
						id,
						room_password: data.room_password,
						admin_password: data.admin_password,
						players: [
							{ name: data.player_name, role: 'admin', banned: false, disconnected: false }
						],
						coins: 0,
						curses: [],
						tasks: [],
						game: 'waiting',
						found: 'none'
					});

					send(peer, { ev: 'create', room_id: id });

					break;
				}

				case 'join': {
					const room = rooms.find((room) => room.id === data.room_id);
					if (!room) {
						send(peer, { ev: 'error', error: 'Room not found' });
						break;
					}

					if (data.password !== (data.admin ? room.admin_password : room.room_password)) {
						send(peer, { ev: 'error', error: 'Wrong password' });
						break;
					}

					let player = room.players.find((player) => player.name === data.player_name);

					if (player?.banned) {
						send(peer, { ev: 'banned' });
						break;
					}

					if (player) {
						if (player.role === 'admin' && !data.admin) {
							send(peer, {
								ev: 'error',
								error:
									'If you are an admin please log in as admin. If you are not an admin, please choose another name.'
							});
							break;
						}

						if (player.role !== 'admin' && data.admin) {
							send(peer, {
								ev: 'error',
								error:
									'If you are an admin, please choose another name. If you are not an admin, turn off join as admin.'
							});
							break;
						}
						player.disconnected = false;
					} else {
						player = {
							role: data.admin ? 'admin' : 'none',
							name: data.player_name,
							banned: false,
							disconnected: false
						};
						room.players.push(player);
					}

					// * Passed all checks, join the room

					peer.context.room = room;
					peer.subscribe(data.room_id);
					peer.subscribe(data.room_id + data.player_name);

					send(peer, { ev: 'join', room_id: data.room_id });

					peer.context.name = data.player_name;

					connected_clients[Number.parseInt(data.room_id)] += 1;

					// * Sync room data to the client
					send(peer, { ev: 'coins', coins: room.coins });
					for (const task of room.tasks) send(peer, { ev: 'task', task, new_task: true });
					for (const curse of room.curses) send(peer, { ev: 'curse', curse, new_curse: true });
					send(peer, { ev: 'game', state: room.game, previous: room.game });
					if (room.started_at) send(peer, { ev: 'started', started_at: room.started_at });
					if (room.ended_at) send(peer, { ev: 'ended', ended_at: room.ended_at });

					// * Sync room data to all clients
					send_to_topic(data.room_id, { ev: 'players', players: room.players });

					break;
				}

				case 'gps': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					const player = room.players.find((player) => player.name === peer.context.name);
					if (!player) break;

					player.coords = data.coords;

					send_to_topic(room.id, { ev: 'gps', name: player.name, coords: data.coords });

					break;
				}

				case 'task': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					if (data.task.state === 'requested') {
						if (room.curses.some((curse) => curse.state !== 'confirmed')) {
							send(peer, {
								ev: 'error',
								error: 'You need to complete all your curses first before you can send tasks'
							});
							break;
						}

						if (room.tasks.some((task) => task.state !== 'confirmed')) {
							send(peer, { ev: 'error', error: 'You can only send one task at a time' });
							break;
						}

						if (room.tasks.some((_task) => data.task.task === _task.task)) {
							send(peer, { ev: 'error', error: 'You cannot request the same task more than once' });
							break;
						}
					}

					if (radars.includes(data.task.task as (typeof radars)[number])) {
						const seeker_coords = room.players.find(
							(player) => player.name === peer.context.name
						)?.coords;

						if (!seeker_coords) {
							send(peer, {
								ev: 'error',
								error: 'The system has not receive your gps. Please try again later.'
							});
							break;
						}

						const hiders_coords = room.players
							.filter((player) => player.role === 'hider' && !player.disconnected)
							.map((player) => player.coords)
							.filter((coords) => coords !== undefined);

						if (!hiders_coords.length)
							send(peer, {
								ev: 'error',
								error:
									'The system has not receive the gps of at least one hider. Please try again later.'
							});

						let inside = 0;

						for (const hider_coords of hiders_coords) {
							const distance = measure(hider_coords, seeker_coords);
							if (distance < radar_meters[data.task.task as (typeof radars)[number]]) {
								inside += 1;
							}
						}

						const new_task: task = {
							task: data.task.task,
							state: 'confirmed',
							result: `${inside} hiders are inside the seeker ${peer.context.name}'s ${data.task.task}`
						};

						room.tasks.push(new_task);
						room.coins += category_coins[task_categories[data.task.task]];

						send_to_topic(room.id, { ev: 'task', task: new_task, new_task: true });
						send_to_topic(room.id, { ev: 'coins', coins: room.coins });
					} else {
						send_to_topic(room.id, { ev: 'task', task: data.task, new_task: false });

						if (data.task.state !== 'requested') room.tasks.pop();
						room.tasks.push(data.task);

						if (data.task.state === 'confirmed') {
							room.coins += category_coins[task_categories[data.task.task]];
							send_to_topic(room.id, { ev: 'coins', coins: room.coins });
						}
					}
					break;
				}

				case 'dice': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					const number_of_dices = Number.parseInt(data.number_of_dices);
					if (Number.isNaN(number_of_dices) || number_of_dices <= 0)
						send(peer, { ev: 'error', error: 'Invalid number of dices' });

					if (number_of_dices * dice_coins > room.coins) {
						send(peer, {
							ev: 'error',
							error: `You do not have enough coins to roll that many dices (1 dice cost 50 coins). The maximum dices you can roll is ${Math.floor(
								room.coins / dice_coins
							)}`
						});
						break;
					}

					if (room.tasks.some((task) => task.state !== 'confirmed')) {
						send(peer, {
							ev: 'error',
							error: 'You need to complete all your tasks first before you can send curses'
						});
						break;
					}

					if (room.curses.some((curse) => curse.state !== 'confirmed')) {
						send(peer, { ev: 'error', error: 'You can only send one curse at a time' });
						break;
					}

					const dices: number[] = [];
					let raw = 0;
					for (let i = 0; i < number_of_dices; i++) {
						const dice = Math.floor(Math.random() * 6) + 1;
						dices.push(dice);
						raw += dice;
					}
					const curse = raw > 24 ? 24 : raw;

					const new_curse: curse = {
						dices,
						curse: curse.toString() as keyof typeof dice_curses,
						state: 'requested'
					};

					send_to_topic(room.id, { ev: 'curse', curse: new_curse, new_curse: false });
					room.coins -= number_of_dices * dice_coins;
					send_to_topic(room.id, { ev: 'coins', coins: room.coins });
					room.curses.push(new_curse);

					break;
				}

				case 'curse': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					send_to_topic(room.id, { ev: 'curse', curse: data.curse, new_curse: false });
					if (data.curse.state !== 'requested') room.curses.pop();
					room.curses.push(data.curse);

					break;
				}

				case 'coins': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					room.coins = data.coins;
					send_to_topic(room.id, { ev: 'coins', coins: data.coins });

					break;
				}

				case 'game': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					send_to_topic(room.id, { ev: 'game', state: data.state, previous: room.game });

					switch (data.state) {
						case 'ingame':
							if (room.ended_at && room.started_at && room.game === 'paused') {
								room.started_at = Date.now() - (room.ended_at - room.started_at);
							} else {
								room.started_at = Date.now();
								for (const task of room.tasks) task.old = true;
								for (const curse of room.curses) curse.old = true;
							}
							room.ended_at = undefined;
							send_to_topic(room.id, { ev: 'started', started_at: room.started_at });
							for (const player of room.players) {
								if (player.coords) player.start_coords = player.coords;
							}
							break;
						case 'ended':
						case 'paused':
							room.ended_at = Date.now();
							send_to_topic(room.id, { ev: 'ended', ended_at: room.ended_at });
							break;
					}

					room.game = data.state;

					break;
				}

				case 'players': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					room.players = data.players;
					for (const player of room.players) {
						if (player.banned) send_to_topic(room.id + player.name, { ev: 'banned' });
					}
					send_to_topic(room.id, { ev: 'players', players: room.players });

					break;
				}

				case 'found': {
					const room = rooms.find((room) => room.id === peer.context.room_id);
					if (!room) break;

					const candidate_player = room.players.find((player) => player.name === peer.context.name);
					if (!candidate_player) break;

					switch (candidate_player.role) {
						case 'seeker':
							if (room.found === 'hider') room.found = 'both';
							else room.found = 'seeker';
							break;
						case 'hider':
							if (room.found === 'seeker') room.found = 'both';
							else room.found = 'hider';
							break;
					}

					if (room.found === 'both') {
						room.game = 'ended';
						send_to_topic(room.id, { ev: 'game', state: 'ended', previous: room.game });
						room.ended_at = Date.now();
						send_to_topic(room.id, { ev: 'ended', ended_at: room.ended_at });
					}

					send_to_topic(room.id, { ev: 'found', found: room.found });

					break;
				}
			}
		} catch (e) {
			peer.send(e);
			console.log(e);
		}
	},
	close(peer) {
		const room = rooms.find((room) => room.id === peer.context.room_id);
		if (!room) return;

		connected_clients[Number.parseInt(room.id)] -= 1;
		if (connected_clients[Number.parseInt(room.id)] > 0) return;
		room_ids.push(room.id);
		const index = rooms.findIndex(({ id }) => id === room?.id);
		if (index === -1) return;
		rooms.splice(index, 1);

		const candidate_player = room.players.find((player) => player.name === peer.context.name);
		if (!candidate_player) return;
		candidate_player.disconnected = true;

		send_to_topic(room.id, { ev: 'players', players: room.players });
	}
};

function send(peer: Peer, data: z.infer<typeof server_client>) {
	peer.send(pack(data));
}

function send_to_topic(topic: string, data: z.infer<typeof server_client>) {
	publish(topic, pack(data));
}

function random<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}

/**
 * * Generally used geo measurement function
 * https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
 */
function measure(
	{ latitude: lat1, longitude: lon1 }: { latitude: number; longitude: number },
	{ latitude: lat2, longitude: lon2 }: { latitude: number; longitude: number }
) {
	const R = 6378.137; // Radius of earth in KM
	const dLat = (lat2 * Math.PI) / 180 - (lat1 * Math.PI) / 180;
	const dLon = (lon2 * Math.PI) / 180 - (lon1 * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const d = R * c;
	return d * 1000; // meters
}
