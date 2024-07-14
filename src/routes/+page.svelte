<script lang="ts">
	import { pushState } from "$app/navigation"
	import { page } from "$app/stores"
	import { socket } from "$lib/const"
	import type { player } from "$lib/types"
	import { untrack } from "svelte"

	let room_id = $state("")
	let players = $state<player[]>([])

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

	socket.on("role", (role) => {
		if (role === "admin") pushState("", { page: "admin" })
		else if (role === "seeker") pushState("", { page: "seeker" })
		else if (role === "hider") pushState("", { page: "hider" })
	})

	socket.on("players", (_players) => {
		players = _players
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

			if (join_id && join_name && join_password && join_admin)
				socket.emit("join", join_id, join_name, join_password, join_admin)

			if (room_id && create_name && create_room_password && create_admin_password)
				socket.emit("join", room_id, create_name, create_admin_password, true)
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

		<div class="text-2xl">Seeker</div>

		<div class="flex flex-row items-center justify-center gap-4">
			<div class="text">Currency:</div>
			<input class="input -sm input-primary w-20" type="number" />
		</div>

		<div></div>
		<!-- * SEEKER -->
	{:else if $page.state.page === "seeker"}
		{@render leave_game_button()}

		<div class="text-3xl">Seeker</div>

		<div class="text-xl">Radar</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			<div class="btn btn-primary">5m</div>
			<div class="btn btn-primary">10m</div>
			<div class="btn btn-primary">25m</div>
			<div class="btn btn-primary">50m</div>
			<div class="btn btn-primary">100m</div>
			<div class="btn btn-primary">200m</div>
			<div class="btn btn-primary">500m</div>
			<div class="btn btn-primary">1km</div>
			<div class="btn btn-primary">2km</div>
			<div class="btn btn-primary">5km</div>
		</div>

		<!-- * HIDER -->
	{:else if $page.state.page === "hider"}
		{@render leave_game_button()}

		<div class="text-3xl">Hider</div>
		<div>Currency:[COINS]</div>
		<div>Seeker used a distance radar on you (you are [INSIDE/OUTSIDE] the radius)</div>
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
