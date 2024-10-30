import daisyui from "daisyui"
import { dark, light } from "daisyui/src/theming/themes"
import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: { extend: { fontFamily: { sans: ['"Space Grotesk"', ...fontFamily.sans] } } },
	plugins: [daisyui],
	daisyui: {
		themes: [
			{
				light: {
					...light,
					primary: "#32D7A0",
					secondary: "#FBAC55"
				},
				dark: {
					...dark,
					primary: "#32D7A0",
					secondary: "#FBAC55",
					"base-content": "#FFF"
				}
			}
		]
	}
} satisfies Config
