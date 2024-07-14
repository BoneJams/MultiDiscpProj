import { io, type Socket } from "socket.io-client"
import type { client_server, server_client } from "./types"

export const socket: Socket<server_client, client_server> = io()
