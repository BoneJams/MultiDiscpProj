// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		export interface PageState {
			page?: 'room' | 'seeker' | 'hider' | 'admin';
		}

		// interface Platform {}
	}
}

export {};
