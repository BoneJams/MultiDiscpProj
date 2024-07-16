<script lang="ts">
	import { pushState } from "$app/navigation"
	import { page } from "$app/stores"
	import { curse_names, dice_curses, task_categories, task_names } from "$lib/const"
	import type { client_server, player, server_client } from "$lib/types"
	import { io, type Socket } from "socket.io-client"
	import { Map, Marker, TileLayer } from "sveaflet"
	import { untrack } from "svelte"

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

	const socket: Socket<server_client, client_server> = io()

	let room_id = $state("")
	let players = $state<player[]>([])
	let seekers = $state<{ name: string; coords: GeolocationCoordinates }[]>([])
	let coins = $state(0)
	let radar_history = $state<{ meters: number; inside: boolean }[]>([])
	let task_history = $state<
		{ task: keyof typeof task_categories; state: "requested" | "completed" | "confirmed" }[]
	>([])
	let curse_history = $state<
		{
			curse: keyof typeof dice_curses
			raw: number
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

	socket.on("gps", (name, coords) => {
		const seeker = seekers.find((seeker) => seeker.name === name)
		if (seeker) seeker.coords = coords
		else seekers.push({ name, coords })
	})

	socket.on("radar", (meters, inside) => {
		radar_history.push({ meters, inside })
	})

	socket.on("coins", (new_coins) => {
		coins = new_coins
	})

	socket.on("task", (task, state) => {
		if (state !== "requested") task_history.pop()
		task_history.push({ task, state })
	})

	socket.on("curse", (curse, raw, state) => {
		if (state !== "requested") curse_history.pop()
		curse_history.push({ curse, raw, state })
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
			/>
			<div class="text-right">Admin Password</div>
			<input
				type="password"
				class="input input-primary input-sm"
				bind:value={create_admin_password}
			/>
			<div class="col-span-2 flex items-center justify-center">
				<button
					class="btn btn-sm btn-primary"
					onclick={() => {
						socket.emit("create", create_name, create_room_password, create_admin_password)
					}}>Create</button
				>
			</div>
			<hr class="col-span-2" />
			<div class="text-xl col-span-2 text-center">Join a room</div>
			<div class="text-right">Your Name</div>
			<input type="text" class="input input-primary input-sm" bind:value={join_name} />
			<div class="text-right">Room ID</div>
			<input class="input input-primary input-sm" type="text" bind:value={join_id} />
			<div class="text-right">Join as Admin?</div>
			<input type="checkbox" class="toggle toggle-primary" bind:checked={join_admin} />
			{#if join_admin}
				<div class="text-right">Admin Password</div>
			{:else}
				<div class="text-right">Room Password</div>
			{/if}
			<input type="password" class="input input-primary input-sm" bind:value={join_password} />

			<div class="col-span-2 flex items-center justify-center">
				<button
					class="btn btn-primary btn-sm"
					disabled={!join_id}
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

		<div class="text-3xl">Room ID: {room_id}</div>

		<div class="text-3xl">Admin Panel</div>

		<div class="grid grid-cols-2 gap-1">
			<div>Player</div>
			<div>Role</div>
			{#each players as player}
				<div>{player.name}</div>
				<select
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
			{/each}
		</div>

		<div class="text-2xl">Seeker</div>

		<div class="text-xl">Radar</div>

		<div class="grid grid-cols-5 items-center justify-center gap-4">
			<div class="btn btn-primary">5m</div>
			<div class="btn btn-error">10m</div>
			<div class="btn btn-primary">25m</div>
			<div class="btn btn-error">50m</div>
			<div class="btn btn-primary">100m</div>
			<div class="btn btn-error">200m</div>
			<div class="btn btn-primary">500m</div>
			<div class="btn btn-error">1km</div>
			<div class="btn btn-primary">2km</div>
			<div class="btn btn-error">5km</div>
		</div>

		<hr class="w-80" />

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
		</div>

		<div></div>
		<!-- * SEEKER -->
	{:else if $page.state.page === "seeker"}
		{@render leave_game_button()}

		<div class="text-3xl">Seeker</div>

		<div class="text-xl">Radar</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			{#each radars as radar}
				<button
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
						class="btn btn-primary"
						onclick={() => {
							socket.emit("task", task as keyof typeof task_categories, "requested")
						}}>{task_names[task as keyof typeof task_categories]}</button
					>
				{/if}
			{/each}
		</div>

		<div class="grid grid-cols-3 items-center justify-center">
			<div>Task</div>
			<div>State</div>
			<div></div>
			{#each task_history as task}
				<div>{task_names[task.task]}</div>
				<div>{task.state}</div>
				{#if task.state === "completed"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("task", task.task, "confirmed")
						}}>Mark as confirmed</button
					>
				{:else}
					<div></div>
				{/if}
			{/each}
		</div>

		<div class="grid grid-cols-3 items-center justify-center">
			<div>Curse</div>
			<div>State</div>
			<div></div>
			{#each curse_history as curse}
				<div>{curse_names[dice_curses[curse.curse]]}</div>
				<div>{curse.state}</div>
				{#if curse.state === "requested"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("curse", curse.curse, curse.raw, "completed")
						}}>Mark as completed</button
					>
				{:else}
					<div></div>
				{/if}
			{/each}
		</div>

		{#each radar_history as radar}
			<div class="text-xl">
				You used a {radar.meters >= 1000 ? `${radar.meters / 1000}km` : `${radar.meters}m`} radar on
				the hiders (they are {radar.inside ? "INSIDE" : "OUTSIDE"} the radius)
			</div>
		{/each}

		<!-- * HIDER -->
	{:else if $page.state.page === "hider"}
		{@render leave_game_button()}

		<div class="text-3xl">Hider</div>
		<div>You have {coins} coins</div>

		<div class="flex flex-row items-center gap-4 justify-center">
			<div>Number of dices:</div>
			<input
				type="text"
				bind:value={number_of_dices_str}
				class="input input-sm input-primary w-20"
			/>
			<button
				class="btn btn-primary btn-sm"
				onclick={() => {
					socket.emit("dice", number_of_dices_str)
				}}>Roll</button
			>
		</div>

		<div class="grid grid-cols-3 items-center justify-center">
			<div>Task</div>
			<div>State</div>
			<div></div>
			{#each task_history as task}
				<div>{task_names[task.task]}</div>
				<div>{task.state}</div>
				{#if task.state === "requested"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("task", task.task, "completed")
						}}>Mark as completed</button
					>
				{:else}
					<div></div>
				{/if}
			{/each}
		</div>

		<div class="grid grid-cols-3 items-center justify-center">
			<div>Curse</div>
			<div>State</div>
			<div></div>
			{#each curse_history as curse}
				<div>{curse_names[dice_curses[curse.curse]]}</div>
				<div>{curse.state}</div>

				{#if curse.state === "completed"}
					<button
						class="btn btn-primary btn-sm btn-error"
						onclick={() => {
							socket.emit("curse", curse.curse, curse.raw, "confirmed")
						}}>Mark as confirmed</button
					>
				{:else}
					<div></div>
				{/if}
			{/each}
		</div>

		{#each radar_history as radar}
			<div class="text-xl">
				Seeker used a {radar.meters >= 1000 ? `${radar.meters / 1000}km` : `${radar.meters}m`} radar
				on you (you are {radar.inside ? "INSIDE" : "OUTSIDE"} the radius)
			</div>
		{/each}

		<div style="width:100%;height:500px;">
			<Map
				options={{
					center: [51.505, -0.09],
					zoom: 13
				}}
			>
				<TileLayer url={"https://tile.openstreetmap.org/{z}/{x}/{y}.png"} />
				{#each seekers as seeker}
					<Marker latLng={[seeker.coords.latitude, seeker.coords.longitude]} />
				{/each}
			</Map>
		</div>
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
