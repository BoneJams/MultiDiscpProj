import type { client_server, server_client } from '$lib/types';
import type { IconOptions } from 'leaflet';
import { type Socket, io } from 'socket.io-client';

export const socket: Socket<server_client, client_server> = io();

export const violet_icon_options: IconOptions = {
	iconUrl: '/img/marker-icon-violet.png',
	shadowUrl: '/img/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
};

export const red_icon_options: IconOptions = {
	iconUrl: '/img/marker-icon-red.png',
	shadowUrl: '/img/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
};

export const blue_icon_options: IconOptions = {
	iconUrl: '/img/marker-icon-blue.png',
	shadowUrl: '/img/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
};

export const yellow_icon_options: IconOptions = {
	iconUrl: '/img/marker-icon-yellow.png',
	shadowUrl: '/img/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
};

export const black_icon_options: IconOptions = {
	iconUrl: '/img/marker-icon-black.png',
	shadowUrl: '/img/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
};
