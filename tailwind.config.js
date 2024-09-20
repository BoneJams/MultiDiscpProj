import { fontFamily } from "tailwindcss/defaultTheme"

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	plugins: [require("daisyui")], // eslint-disable-line @typescript-eslint/no-require-imports
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Space Grotesk"', ...fontFamily.sans]
			}
		}
	},
	daisyui: {
		themes: [
			{
				light: {
					...require("daisyui/src/theming/themes").light, // eslint-disable-line @typescript-eslint/no-require-imports
					primary: "#32D7A0",
					secondary: "#FBAC55"
				}
			},
			{
				dark: {
					...require("daisyui/src/theming/themes").dark, // eslint-disable-line @typescript-eslint/no-require-imports
					primary: "#32D7A0",
					secondary: "#FBAC55",
					"base-content": "#FFFFFF"
				}
			}
		]
	}
}
