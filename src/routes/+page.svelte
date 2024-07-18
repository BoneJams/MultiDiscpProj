<script lang="ts">
	import { pushState } from "$app/navigation"
	import { page } from "$app/stores"
	import {
		curse_names,
		dice_curses,
		task_categories,
		task_descriptions,
		task_names
	} from "$lib/const"
	import type { client_server, player, server_client } from "$lib/types"
	import { Icon } from "leaflet"
	import { io, type Socket } from "socket.io-client"
	import { LayerGroup, Map, Marker, Popup, TileLayer } from "sveaflet"
	import { untrack } from "svelte"

	let greenIcon = new Icon({
		iconUrl: "/img/marker-icon-green.png",
		shadowUrl: "/img/marker-shadow.png",
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
	})

	let redIcon = new Icon({
		iconUrl: "/img/marker-icon-red.png",
		shadowUrl: "/img/marker-shadow.png",
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
	})

	let blueIcon = new Icon({
		iconUrl: "/img/marker-icon-blue.png",
		shadowUrl: "/img/marker-shadow.png",
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
	})

	const radars: (keyof typeof task_categories)[] = [
		"radar5",
		"radar10",
		"radar25",
		"radar50",
		"radar100",
		"radar200",
		"radar500",
		"radar1000",
		"radar2000",
		"radar5000"
	]

	let number_of_dices_str = $state("")
	let end_state = $state<"hider" | "seeker" | "both">()
	let started_at = $state(0)
	let time = $state(0)
	let hour = $derived(
		Math.floor(time / 3600000)
			.toString()
			.padStart(2, "0")
	)
	let minute = $derived(
		Math.floor((time % 3600000) / 60000)
			.toString()
			.padStart(2, "0")
	)
	let second = $derived(
		Math.floor((time % 60000) / 1000)
			.toString()
			.padStart(2, "0")
	)
	let ms = $derived((time % 1000).toString().padStart(3, "0"))

	const socket: Socket<server_client, client_server> = io()

	let game = $state<"undefined" | "started" | "ended" | "aborted">("undefined")
	let room_id = $state("")
	let players = $state<player[]>([])
	let self_coords = $state<GeolocationCoordinates>()
	let hiders = $state<{ name: string; coords: GeolocationCoordinates }[]>([])
	let seekers = $state<{ name: string; coords: GeolocationCoordinates }[]>([])
	let coins = $state(0)
	let task_history = $state<
		{
			task: keyof typeof task_categories
			state: "requested" | "completed" | "confirmed"
			result?: string
		}[]
	>([])
	let curse_history = $state<
		{
			curse: keyof typeof dice_curses
			dices: number[]
			state: "requested" | "completed" | "confirmed"
		}[]
	>([])

	let create_name = $state("")
	let create_room_password = $state("")
	let create_admin_password = $state("")

	let join_id = $state("")
	let join_name = $state("")
	let join_admin = $state(false)
	let join_password = $state("")

	socket.on("create", (id) => {
		socket.emit("join", id, create_name, create_admin_password, true)
	})

	socket.on("join", (id) => {
		room_id = id
		pushState("", { page: "room" })
	})

	socket.on("error", (error) => {
		alert(error)
	})

	socket.on("players", (_players) => {
		players = _players
		if (join_id && join_name) {
			const player = players.find((player) => player.name === join_name)
			if (!player) return

			switch (player.role) {
				case "admin":
					pushState("", { page: "admin" })
					break
				case "seeker":
					pushState("", { page: "seeker" })
					break
				case "hider":
					pushState("", { page: "hider" })
					break
			}
		}

		if (room_id && create_name) {
			const player = players.find((player) => player.name === create_name)
			if (!player) return

			switch (player.role) {
				case "admin":
					pushState("", { page: "admin" })
					break
				case "seeker":
					pushState("", { page: "seeker" })
					break
				case "hider":
					pushState("", { page: "hider" })
					break
			}
		}
	})

	socket.on("gps", (name, coords, is_hider) => {
		if (is_hider) {
			const hider = hiders.find((hider) => hider.name === name)
			if (hider) hider.coords = coords
			else hiders.push({ name, coords })
		} else {
			const seeker = seekers.find((seeker) => seeker.name === name)
			if (seeker) seeker.coords = coords
			else seekers.push({ name, coords })
		}
	})

	socket.on("coins", (new_coins) => {
		coins = new_coins
	})

	socket.on("task", (task, state, result, persist) => {
		if (state !== "requested" && !persist) task_history.pop()
		task_history.push({ task, state, result })
	})

	socket.on("curse", (curse, dices, state, persist) => {
		if (state !== "requested" && !persist) curse_history.pop()
		curse_history.push({ curse, dices, state })
	})

	socket.on("game", (state) => {
		console.log(state)
		game = state
	})

	socket.on("ban", () => {
		alert("You have been banned from this room")
		setTimeout(() => {
			sessionStorage.clear()
			location.reload()
		}, 3000)
	})

	socket.on("end", (state) => {
		end_state = state
	})

	socket.on("start", (ms) => {
		started_at = ms
		update_time()
	})

	socket.on("time", (ms) => {
		time = ms
	})

	$effect(() => {
		untrack(() => {
			room_id = sessionStorage.getItem("room_id") ?? ""

			create_name = sessionStorage.getItem("create_name") ?? ""
			create_room_password = sessionStorage.getItem("create_room_password") ?? ""
			create_admin_password = sessionStorage.getItem("create_admin_password") ?? ""

			join_id = sessionStorage.getItem("join_id") ?? ""
			join_name = sessionStorage.getItem("join_name") ?? ""
			join_admin = sessionStorage.getItem("join_admin") === "true"
			join_password = sessionStorage.getItem("join_password") ?? ""

			if (join_id && join_name) socket.emit("join", join_id, join_name, join_password, join_admin)

			if (room_id && create_name)
				socket.emit("join", room_id, create_name, create_admin_password, true)

			navigator.geolocation.watchPosition(
				(position) => {
					self_coords = position.coords
					socket.emit("gps", position.coords)
				},
				(e) => {
					console.log(e)
				},
				{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
			)
		})
	})

	$effect(() => {
		sessionStorage.setItem("room_id", room_id)

		sessionStorage.setItem("create_name", create_name)
		sessionStorage.setItem("create_room_password", create_room_password)
		sessionStorage.setItem("create_admin_password", create_admin_password)

		sessionStorage.setItem("join_id", join_id)
		sessionStorage.setItem("join_name", join_name)
		sessionStorage.setItem("join_admin", join_admin.toString())
		sessionStorage.setItem("join_password", join_password)
	})

	function create(ev: KeyboardEvent | MouseEvent) {
		if (ev instanceof KeyboardEvent && ev.key !== "Enter") return
		if (!create_name) return alert("Please enter a name")
		socket.emit("create", create_name, create_room_password, create_admin_password)
	}

	function join(ev: KeyboardEvent | MouseEvent) {
		if (ev instanceof KeyboardEvent && ev.key !== "Enter") return
		if (!join_id || !join_name) return alert("Please enter a room ID and a name")
		socket.emit("join", join_id, join_name, join_password, join_admin)
	}

	function update_time() {
		if (game !== "started") return
		requestAnimationFrame(update_time)
		time = Date.now() - started_at
	}
</script>

<div class="m-4 flex flex-col items-center justify-center gap-4">
	{#if !$page.state.page}
		<div class="grid grid-cols-2 gap-4 items-center">
			<div class="text-xl col-span-2 text-center">Create a new room</div>
			<div class="text-right">Your Name</div>
			<input type="text" class="input input-primary input-sm" bind:value={create_name} />
			<div class="text-right">Room Password</div>
			<input
				type="password"
				class="input input-primary input-sm"
				bind:value={create_room_password}
				onkeydown={create}
			/>
			<div class="text-right">Admin Password</div>
			<input
				type="password"
				class="input input-primary input-sm"
				bind:value={create_admin_password}
				onkeydown={create}
			/>
			<div class="col-span-2 flex items-center justify-center">
				<button disabled={!create_name} class="btn btn-sm btn-primary" onclick={create}
					>Create</button
				>
			</div>
			<hr class="col-span-2" />
			<div class="text-xl col-span-2 text-center">Join a room</div>
			<div class="text-right">Your Name</div>
			<input
				type="text"
				class="input input-primary input-sm"
				bind:value={join_name}
				onkeydown={join}
			/>
			<div class="text-right">Room ID</div>
			<input
				class="input input-primary input-sm"
				inputmode="numeric"
				type="text"
				bind:value={join_id}
				onkeydown={join}
			/>
			<div class="text-right">Join as Admin?</div>
			<input type="checkbox" class="toggle toggle-primary" bind:checked={join_admin} />
			{#if join_admin}
				<div class="text-right">Admin Password</div>
			{:else}
				<div class="text-right">Room Password</div>
			{/if}
			<input
				type="password"
				class="input input-primary input-sm"
				bind:value={join_password}
				onkeydown={join}
			/>

			<div class="col-span-2 flex items-center justify-center">
				<button
					class="btn btn-primary btn-sm"
					disabled={!join_name || !join_id}
					onkeydown={join}
					onclick={() => {
						if (!join_id) return
						socket.emit("join", join_id, join_name, join_password, join_admin)
					}}>Join</button
				>
			</div>
		</div>

		<!-- * ROOM -->
	{:else if $page.state.page === "room"}
		{@render leave_game_button()}

		<div class="text-3xl">Room ID: {room_id}</div>
		<div class="text-xl">Player List</div>
		<div class="grid grid-cols-[1fr_2rem] items-center justify-center gap-4">
			<div>[Player 1]</div>
			<button class="btn btn-error btn-sm">X</button>
			<div>[Player 2]</div>
			<button class="btn btn-error btn-sm">X</button>
			<div>[Player 3]</div>
			<button class="btn btn-error btn-sm">X</button>
			<div>...</div>
		</div>

		<div class="fixed bottom-4 flex w-full items-center justify-center">
			<button class="btn btn-primary">Start Game</button>
		</div>
		<!-- * ADMIN -->
	{:else if $page.state.page === "admin"}
		{@render leave_game_button()}

		<div>{hour}:{minute}:{second}.{ms}</div>

		<div class="text-3xl">Room ID: {room_id}</div>

		<div class="text-3xl">Admin Panel</div>

		<hr class="w-full" />

		<div class="text-xl">Game</div>
		<select
			class="select select-primary select-sm"
			bind:value={game}
			onchange={() => socket.emit("game", game)}
		>
			<option value="undefined">Not yet started</option>
			<option value="started">Started</option>
			<option value="ended">Ended</option>
			<option value="aborted">Aborted</option>
		</select>

		<hr class="w-full" />

		<div class="grid grid-cols-3 gap-1">
			<div>Player</div>
			<div>Role</div>
			<div></div>
			{#each players as player}
				<div class={player.banned ? "text-base-content text-opacity-50" : ""}>{player.name}</div>
				<select
					disabled={player.name === join_name || player.name === create_name || player.banned}
					class="select select-primary select-sm"
					bind:value={player.role}
					onchange={() => {
						if (!player.role) return
						socket.emit("role", player.name, player.role)
					}}
				>
					<option value={undefined}>Select Role...</option>
					<option value="admin">Admin</option>
					<option value="seeker">Seeker</option>
					<option value="hider">Hider</option>
				</select>
				<select
					disabled={player.name === join_name || player.name === create_name}
					class="select select-sm select-primary"
					bind:value={player.banned}
					onchange={() => socket.emit("ban", player.name, player.banned)}
				>
					<option value={false}>Not banned</option>
					<option value={true}>Banned</option>
				</select>
			{/each}
		</div>

		<hr class="w-full" />

		<div class="text-2xl">Hider</div>

		<div class="flex flex-row items-center justify-center gap-4">
			<div class="text">Coins:</div>
			<input
				class="input input-sm input-primary w-20"
				type="number"
				bind:value={coins}
				onkeydown={(ev) => {
					if (ev.key === "Enter") socket.emit("coins", coins)
				}}
			/>
			<button class="btn btn-error btn-sm" onclick={() => socket.emit("coins", coins)}
				>Override coins</button
			>
		</div>

		<hr class="w-full" />

		{@render render_task_history("admin")}

		<hr class="w-full" />

		{@render render_curse_history("admin")}

		<hr class="w-full" />

		{@render render_map()}

		<!-- * SEEKER -->
	{:else if $page.state.page === "seeker"}
		{@render leave_game_button()}

		<div>{hour}:{minute}:{second}.{ms}</div>

		<div class="text-3xl">Seeker</div>

		<div class="text-xl">Radar</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			{#each radars as radar}
				<button
					disabled={game !== "started"}
					class="btn btn-primary"
					onclick={() => {
						socket.emit("task", radar, "requested")
					}}>{task_names[radar]}</button
				>
			{/each}
		</div>
		<div>Tasks</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			{#each Object.entries(task_categories) as [task, category]}
				{#if category !== "radar"}
					<button
						disabled={game !== "started"}
						class="btn btn-primary"
						onclick={() => {
							socket.emit("task", task as keyof typeof task_categories, "requested")
						}}>{task_names[task as keyof typeof task_categories]}</button
					>
				{/if}
			{/each}
		</div>

		<hr class="w-full" />

		{@render render_task_history("seeker")}

		<hr class="w-full" />

		{@render render_curse_history("seeker")}

		<hr class="w-full" />

		{@render render_map()}

		<hr class="w-full" />

		{#if end_state === "seeker"}
			<div>You have signaled that you found hiders. Waiting for the hiders to confirm...</div>
		{:else if end_state === "hider"}
			<div>
				The hiders have signaled that you have found them. Do you want to confirm that you have
				found the hiders?
			</div>
		{:else if end_state === "both"}
			<div>Both you and hiders have signaled that you have found them.</div>
		{/if}

		<button
			class="btn btn-error btn-sm"
			disabled={game !== "started"}
			onclick={() => {
				socket.emit("end")
			}}>Seekers found hiders</button
		>

		<!-- * HIDER -->
	{:else if $page.state.page === "hider"}
		{@render leave_game_button()}

		<div>{hour}:{minute}:{second}.{ms}</div>

		<div class="text-3xl">Hider</div>
		<div>You have {coins} coins</div>

		<div class="flex flex-row items-center gap-4 justify-center">
			<div>Number of dices:</div>
			<input
				type="text"
				bind:value={number_of_dices_str}
				class="input input-sm input-primary w-20"
				onkeydown={(ev) => {
					if (ev.key === "Enter") socket.emit("dice", number_of_dices_str)
				}}
			/>
			<button
				disabled={game !== "started"}
				class="btn btn-primary btn-sm"
				onclick={() => {
					socket.emit("dice", number_of_dices_str)
				}}>Roll</button
			>
		</div>

		<hr class="w-full" />

		{@render render_task_history("hider")}

		<hr class="w-full" />

		{@render render_curse_history("hider")}

		<hr class="w-full" />

		{@render render_map()}

		<hr class="w-full" />

		{#if end_state === "hider"}
			<div>
				You have signaled that the seeker have found you. Waiting for the seekers to confirm...
			</div>
		{:else if end_state === "seeker"}
			<div>
				The seekers have signaled that they have found you. Do you want to confirm that they have
				found you?
			</div>
		{:else if end_state === "both"}
			<div>Both you and seekers have signaled that they have found you.</div>
		{/if}

		<button
			class="btn btn-error btn-sm"
			disabled={game !== "started"}
			onclick={() => {
				socket.emit("end")
			}}>Seekers found hiders</button
		>
	{/if}
</div>

{#snippet leave_game_button()}
	<button
		class="btn btn-error btn-sm fixed top-0 left-0 m-1"
		onclick={() => {
			sessionStorage.clear()
			location.reload()
		}}>Leave Game</button
	>
{/snippet}

{#snippet render_curse_history(role: "admin" | "seeker" | "hider")}
	<div class="text-xl">Curse History</div>

	<div class="grid grid-cols-4 w-full items-center justify-center gap-4">
		<div>Dices</div>
		<div>Curse</div>
		<div>State</div>
		<div>Result</div>
		{#each curse_history as curse}
			<div>{curse.dices.join(", ")}</div>
			<div>{curse_names[dice_curses[curse.curse]]}</div>
			<div
				class={curse.state === "requested"
					? "text-error"
					: curse.state === "completed"
						? "text-warning"
						: curse.state === "confirmed"
							? "text-success"
							: ""}
			>
				{curse.state}
			</div>

			<div>
				{#if (role === "seeker" || role === "admin") && curse.state === "requested"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("curse", curse.curse, curse.dices, "completed")
						}}>Mark as completed</button
					>
				{/if}
				{#if (role === "hider" || role === "admin") && curse.state === "completed"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("curse", curse.curse, curse.dices, "confirmed")
						}}
						>Mark as confirmed
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet render_task_history(role: "admin" | "seeker" | "hider")}
	<div class="text-xl">Task History</div>

	<div class="grid grid-cols-3 w-full items-center justify-center gap-4">
		<div>Task</div>
		<div>State</div>
		<div>Result</div>
		{#each task_history as task}
			<div>{task_names[task.task]} ({task_descriptions[task.task]})</div>
			<div
				class={task.state === "requested"
					? "text-error"
					: task.state === "completed"
						? "text-warning"
						: task.state === "confirmed"
							? "text-success"
							: ""}
			>
				{task.state}
			</div>
			<div>
				{#if (role === "hider" || role === "admin") && task.state === "requested"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("task", task.task, "completed")
						}}>Mark as completed</button
					>
				{/if}

				{#if (role === "seeker" || role === "admin") && task.state === "completed"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("task", task.task, "confirmed")
						}}>Mark as confirmed</button
					>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet render_map()}
	<div class="w-full aspect-video">
		<Map
			options={{
				center: [
					self_coords?.latitude ?? 11.107654906837048,
					self_coords?.longitude ?? 106.61411702472978
				],
				zoom: 14
			}}
		>
			<TileLayer url={"https://tile.openstreetmap.org/{z}/{x}/{y}.png"} />

			{#if game === "started"}
				{#each hiders as hider}
					{#if hider.name !== create_name && hider.name !== join_name}
						<LayerGroup>
							<Marker
								latLng={[hider.coords.latitude, hider.coords.longitude]}
								options={{ icon: blueIcon }}
							>
								<Popup options={{ content: `Hider: ${hider.name}` }}></Popup>
							</Marker>
						</LayerGroup>
					{/if}
				{/each}

				{#each seekers as seeker}
					{#if seeker.name !== create_name && seeker.name !== join_name}
						<LayerGroup>
							<Marker
								latLng={[seeker.coords.latitude, seeker.coords.longitude]}
								options={{ icon: redIcon }}
							>
								<Popup options={{ content: `Seeker: ${seeker.name}` }}></Popup>
							</Marker>
						</LayerGroup>
					{/if}
				{/each}
			{/if}

			{#if self_coords}
				<LayerGroup>
					<Marker
						latLng={[self_coords.latitude, self_coords.longitude]}
						options={{ icon: greenIcon }}
					>
						<Popup options={{ content: "You" }}></Popup>
					</Marker>
				</LayerGroup>
			{/if}
		</Map>
	</div>
{/snippet}
