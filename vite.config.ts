import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import server from "./src/lib/server"

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss(),
		{
			name: "server",
			configureServer({ httpServer }) {
				if (!httpServer) return
				server(httpServer)
			}
		}
	],
	server: { allowedHosts: ["laghs.20050703.xyz"] }
})
