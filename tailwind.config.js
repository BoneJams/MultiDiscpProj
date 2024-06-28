/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	plugins: [require("daisyui")], // eslint-disable-line @typescript-eslint/no-require-imports
	daisyui: {
		themes: [
			{
				light: {
					...require("daisyui/src/theming/themes")["light"], // eslint-disable-line @typescript-eslint/no-require-imports
					primary: "#41A8DA",
					secondary: "#FBAC55"
				}
			}
			// {
			// 	dark: {
			// 		...require("daisyui/src/theming/themes")["dark"], // eslint-disable-line @typescript-eslint/no-require-imports
			// 		primary: "#41A8DA",
			// 		secondary: "#FBAC55",
			// 		"base-content": "#FFFFFF"
			// 	}
			// },
			// {
			// 	black: {
			// 		...require("daisyui/src/theming/themes")["dark"], // eslint-disable-line @typescript-eslint/no-require-imports
			// 		// primary: "#41A8DA",
			// 		// secondary: "#FBAC55",
			// 		"base-content": "#FFFFFF",
			// 		"base-100": "#000000"
			// 	}
			// }
		]
	}
}
