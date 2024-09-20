<script lang="ts">
import { pushState } from "$app/navigation"
import { page } from "$app/stores"
import {
	black_icon,
	blue_icon,
	red_icon,
	socket,
	violet_icon,
	yellow_icon
} from "$lib/client/const"
import {
	curse_descriptions,
	curse_names,
	dice_curses,
	radars,
	task_categories,
	task_descriptions,
	task_names
} from "$lib/const"
import type { curse, found_state, game_state, player, task } from "$lib/types"
import { Circle, LayerGroup, Marker, Popup, Map as SveafletMap, TileLayer } from "sveaflet"
import { untrack } from "svelte"

// * STATES

// biome-ignore lint/style/useConst: false positive
let number_of_dices_str = $state("")

let started_at = $state<number>()
let ended_at = $state<number>()

let time = $state(0)

const hour = $derived(
	Math.floor(time / 3600000)
		.toString()
		.padStart(2, "0")
)
const minute = $derived(
	Math.floor((time % 3600000) / 60000)
		.toString()
		.padStart(2, "0")
)
const second = $derived(
	Math.floor((time % 60000) / 1000)
		.toString()
		.padStart(2, "0")
)
const ms = $derived((time % 1000).toString().padStart(3, "0"))

let found = $state<found_state>("none")

let game = $state<game_state>("waiting")
let room_id = $state("")
let players = $state<player[]>([])

let self_coords = $state<{ latitude: number; longitude: number; accuracy: number }>()
let map_center = $state({ latitude: 11.107654906837048, longitude: 106.61411702472978 })

let coins = $state(0)
const tasks = $state<task[]>([])
const curses = $state<curse[]>([])

let create_name = $state("")
let create_room_password = $state("")
let create_admin_password = $state("")

let join_id = $state("")
let join_name = $state("")
let join_admin = $state(false)
let join_password = $state("")

// * SOCKET

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

socket.on("coins", (new_coins) => {
	coins = new_coins
})

socket.on("task", (task, new_task) => {
	if (task.state !== "requested" && !new_task) tasks.pop()
	tasks.push(task)
})

socket.on("curse", (curse, new_curse) => {
	if (curse.state !== "requested" && !new_curse) curses.pop()
	curses.push(curse)
})

socket.on("game", (state, previous) => {
	if (previous !== "paused" && state === "ingame") {
		for (const task of tasks) task.old = true
		for (const curse of curses) curse.old = true
	}
	game = state
})

socket.on("banned", () => {
	alert("You have been banned from this room")
	setTimeout(() => {
		sessionStorage.clear()
		location.reload()
	}, 3000)
})

socket.on("found", (state) => {
	found = state
})

socket.on("started", (ms) => {
	ended_at = undefined
	started_at = ms
	update_time()
})

socket.on("ended", (ms) => {
	ended_at = ms
	time = ended_at - (started_at ?? 0)
})

// * $EFFECTS

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
				if (!self_coords) map_center = position.coords
				self_coords = position.coords
				socket.emit("gps", position.coords)
			},
			(e) => {
				console.log(e)
				alert(
					"GPS is not available. Please make sure you have allow location access. If it still does not work, please try refreshing the page. If it still does not work, please use another device, preferably a mobile phone."
				)
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

// * FUNCTIONS

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
	if (game !== "ingame") return
	requestAnimationFrame(update_time)
	time = (ended_at ?? Date.now()) - (started_at ?? Date.now())
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
		{@render top()}

		<div class="text-xl">Waiting for admin to assign roles...</div>
		<div>Player List:</div>
		<div class="grid grid-cols-2 gap-x-4 gap-y-2">
			<div>Player</div>
			<div>Role</div>
			{#each players as player}
				{#if !player.banned}
					<div>{player.name}</div>
					<div>{player.role ?? "Waiting for admin to assign role..."}</div>
				{/if}
			{/each}
		</div>

		<!-- * ADMIN -->
	{:else if $page.state.page === "admin"}
		{@const hider_coords = players
			.filter((player) => player.role === "hider" && !player.disconnected)
			.map((player) => player.coords)
			.filter((coords) => coords !== undefined)}
		{@const seeker_coords = players
			.filter((player) => player.role === "seeker" && !player.disconnected)
			.map((player) => player.coords)
			.filter((coords) => coords !== undefined)}
		{@render top()}

		<div class="text-3xl">Admin Panel</div>

		<hr class="w-full" />

		<div class="text-xl">Game</div>
		{#if !hider_coords.length || !seeker_coords.length}
			<div>The system has not receive the gps of at least one seeker and at least one hider.</div>
		{/if}
		<select
			disabled={!hider_coords.length || !seeker_coords.length}
			class="select select-primary select-sm"
			bind:value={game}
			onchange={() => socket.emit("game", game)}
		>
			<option value="waiting">Not In Game (Not Started Yet)</option>
			<option value="ingame">In Game (Started)</option>
			<option value="paused">Paused</option>
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
					onchange={() => socket.emit("players", players)}
				>
					<option value="none">Select Role...</option>
					<option value="admin">Admin</option>
					<option value="seeker">Seeker</option>
					<option value="hider">Hider</option>
				</select>
				<select
					disabled={player.name === join_name || player.name === create_name}
					class="select select-sm select-primary"
					bind:value={player.banned}
					onchange={() => socket.emit("players", players)}
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

		{@render bottom("admin")}

		<!-- * SEEKER -->
	{:else if $page.state.page === "seeker"}
		{@render top()}

		<div class="text-3xl">Seeker</div>

		<div class="text-xl">Radar</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			{#each radars as radar}
				<button
					disabled={game !== "ingame"}
					class="btn btn-primary"
					onclick={() => {
						socket.emit("task", { task: radar, state: "requested" })
					}}>{task_names[radar]}</button
				>
			{/each}
		</div>
		<div>Tasks</div>
		<div class="grid grid-cols-5 items-center justify-center gap-4">
			{#each Object.entries(task_categories) as [task, category]}
				{#if category !== "radar"}
					<button
						disabled={game !== "ingame"}
						class="btn btn-primary"
						onclick={() => {
							socket.emit("task", {
								task: task as keyof typeof task_categories,
								state: "requested"
							})
						}}>{task_names[task as keyof typeof task_categories]}</button
					>
				{/if}
			{/each}
		</div>

		{@render bottom("seeker")}

		<!-- * HIDER -->
	{:else if $page.state.page === "hider"}
		{@render top()}

		<div class="text-3xl">Hider</div>
		<div>You have {coins} coins</div>

		<div class="flex flex-row items-center gap-4 justify-center">
			<div>Number of dices:</div>
			<input
				type="text"
				inputmode="numeric"
				bind:value={number_of_dices_str}
				class="input input-sm input-primary w-20"
				onkeydown={(ev) => {
					if (ev.key === "Enter") socket.emit("dice", number_of_dices_str)
				}}
			/>
			<button
				disabled={game !== "ingame"}
				class="btn btn-primary btn-sm"
				onclick={() => {
					socket.emit("dice", number_of_dices_str)
				}}>Roll</button
			>
		</div>

		{@render bottom("hider")}
	{/if}
</div>

{#snippet top()}
	<button
		class="btn btn-error btn-sm"
		onclick={() => {
			sessionStorage.clear()
			location.reload()
		}}>Leave Game</button
	>

	<div class="font-mono">{hour}:{minute}:{second}.{ms} ({game})</div>

	<div class="text-3xl">Room ID: {room_id}</div>
{/snippet}

{#snippet bottom(role: "admin" | "seeker" | "hider")}
	<hr class="w-full" />

	{@render task_history(role)}

	<hr class="w-full" />

	{@render curse_history(role)}

	<hr class="w-full" />

	{#if role !== "admin"}
		{#if found === "both"}
			<div>Both seekers and hiders have confirmed that seekers have found hiders.</div>
		{:else if found === "seeker"}
			<div>
				Seekers have confirmed that seekers have found hiders. Waiting for hiders to confirm...
			</div>
		{:else if found === "hider"}
			<div>
				Hiders have confirmed that seekers have found hiders. Waiting for seekers to confirm...
			</div>
		{/if}
		<button
			disabled={game !== "ingame"}
			class="btn btn-error btn-sm"
			onclick={() => {
				socket.emit("found")
			}}>Confirms that seekers have found hiders</button
		>

		<hr class="w-full" />
	{/if}

	<button
		class="btn btn-primary btn-sm"
		disabled={!self_coords}
		onclick={() => {
			if (self_coords) {
				map_center = { latitude: 11.107654906837048, longitude: 106.61411702472978 }
				map_center = self_coords
			}
		}}>Re-center map (to your location)</button
	>

	{@render map()}
{/snippet}

{#snippet curse_history(role: "admin" | "seeker" | "hider")}
	<div class="text-xl">Curse History</div>

	<div class="grid grid-cols-4 w-full items-center justify-center gap-4">
		<div>Dices</div>
		<div>Curse</div>
		<div>State</div>
		<div>Result</div>
		{#each curses as curse}
			{#if !curse.old}
				{@render display_curse(role, curse)}
			{/if}
		{/each}

		{#if curses.filter((curse) => curse.old).length}
			<details class="collapse collapse-arrow text-opacity-50 text-base-content col-span-4 text-sm">
				<summary class="collapse-title text-center">Old Curses</summary>
				<div class="collapse-content grid grid-cols-4 items-center justify-center gap-4 p-0">
					{#each curses as curse}
						{#if curse.old}
							{@render display_curse(role, curse)}
						{/if}
					{/each}
				</div>
			</details>
		{/if}
	</div>
{/snippet}

{#snippet task_history(role: "admin" | "seeker" | "hider")}
	<div class="text-xl">Task History</div>

	<div class="grid grid-cols-3 w-full items-center justify-center gap-4">
		<div>Task</div>
		<div>State</div>
		<div>Result</div>
		{#each tasks as task}
			{#if !task.old}
				{@render display_task(role, task)}
			{/if}
		{/each}

		{#if tasks.filter((task) => task.old).length}
			<details class="collapse collapse-arrow col-span-3 text-opacity-50 text-base-content text-sm">
				<summary class="collapse-title text-center">Old Tasks</summary>
				<div class="collapse-content grid grid-cols-3 items-center justify-center gap-4 p-0">
					{#each tasks as task}
						{#if task.old}
							{@render display_task(role, task)}
						{/if}
					{/each}
				</div>
			</details>
		{/if}
	</div>
{/snippet}

{#snippet display_task(role: "admin" | "seeker" | "hider", task: task)}
	<div>
		{task_names[task.task]}{task_descriptions[task.task]
			? ` (${task_descriptions[task.task]})`
			: ""}
	</div>
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
					socket.emit("task", { ...task, state: "completed" })
				}}>Mark the task as completed</button
			>
		{/if}

		{#if (role === "seeker" || role === "admin") && task.state === "completed"}
			<button
				class="btn btn-primary btn-sm btn-error"
				onclick={() => {
					socket.emit("task", { ...task, state: "confirmed" })
				}}>Confirm the task is completed</button
			>
		{/if}

		{#if task.result}
			<div>{task.result}</div>
		{/if}
	</div>
{/snippet}

{#snippet display_curse(role: "admin" | "seeker" | "hider", curse: curse)}
	<div>{curse.dices.join(", ")}</div>
	<div>
		{curse_names[dice_curses[curse.curse]]}{curse_descriptions[dice_curses[curse.curse]]
			? ` (${curse_descriptions[dice_curses[curse.curse]]})`
			: ""}
	</div>
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
					socket.emit("curse", { ...curse, state: "completed" })
				}}>Mark the curse as completed</button
			>
		{/if}
		{#if (role === "hider" || role === "admin") && curse.state === "completed"}
			<button
				class="btn btn-primary btn-sm btn-error"
				onclick={() => {
					socket.emit("curse", { ...curse, state: "confirmed" })
				}}>Confirm the curse is completed</button
			>
		{/if}
	</div>
{/snippet}

{#snippet map()}
	<div class="w-full aspect-video">
		<SveafletMap
			options={{
				center: [map_center.latitude, map_center.longitude],
				zoom: 14
			}}
		>
			<TileLayer url={"https://tile.openstreetmap.org/{z}/{x}/{y}.png"} />

			{#if game === "ingame"}
				{@const self_name = create_name || join_name}
				{@const self_role = players.find((player) => player.name === self_name)?.role}
				{#each players as player}
					{@const can_see =
						// * Admin can see all players.
						self_role === "admin" ||
						// * Seeker can see hiders and seekers.
						(self_role === "hider" && (player.role === "hider" || player.role === "seeker")) ||
						// * Seeker can see seekers only.
						(self_role === "seeker" && player.role === "seeker")}
					{#if player.coords && self_name !== player.name && can_see && player.role !== "none"}
						<LayerGroup>
							<Marker
								latLng={[player.coords.latitude, player.coords.longitude]}
								options={{
									icon: player.disconnected
										? black_icon
										: player.role === "admin"
											? yellow_icon
											: player.role === "seeker"
												? red_icon
												: player.role === "hider"
													? blue_icon
													: undefined
								}}
							>
								<Popup options={{ content: `${player.role}: ${player.name}` }}></Popup>
							</Marker>
						</LayerGroup>

						<LayerGroup>
							<Circle
								latLng={[player.coords.latitude, player.coords.longitude]}
								options={{
									color: player.disconnected
										? "#3D3D3D"
										: player.role === "admin"
											? "#CAC428"
											: player.role === "seeker"
												? "#CB2B3E"
												: player.role === "hider"
													? "#2A81CB"
													: undefined,
									fillColor: player.disconnected
										? "#3D3D3D"
										: player.role === "admin"
											? "#CAC428"
											: player.role === "seeker"
												? "#CB2B3E"
												: player.role === "hider"
													? "#2A81CB"
													: undefined,
									fillOpacity: 0.1,
									radius: player.coords.accuracy
								}}
							></Circle>
						</LayerGroup>

						{#if player.role === "hider" && player.start_coords}
							<LayerGroup>
								<Circle
									latLng={[player.start_coords.latitude, player.start_coords.longitude]}
									options={{
										color: "#00FFFF",
										fillColor: "#00FFFF",
										fillOpacity: 0.1,
										radius: 1000
									}}
								></Circle>
							</LayerGroup>
						{/if}
					{/if}
				{/each}
			{/if}

			{#if self_coords}
				{@const self_name = create_name || join_name}
				{@const self_role = players.find((player) => player.name === self_name)?.role}
				{@const self_start_coords = players.find(
					(player) => player.name === self_name
				)?.start_coords}

				<LayerGroup>
					<Marker
						latLng={[self_coords.latitude, self_coords.longitude]}
						options={{ icon: violet_icon }}
					>
						<Popup options={{ content: "You" }}></Popup>
					</Marker>
				</LayerGroup>

				<LayerGroup>
					<Circle
						latLng={[self_coords.latitude, self_coords.longitude]}
						options={{
							color: "#9C2BCB",
							fillColor: "#9C2BCB",
							fillOpacity: 0.1,
							radius: self_coords.accuracy
						}}
					></Circle>
				</LayerGroup>

				{#if self_role === "hider" && self_start_coords}
					<LayerGroup>
						<Circle
							latLng={[self_start_coords.latitude, self_start_coords.longitude]}
							options={{
								color: "green",
								fillColor: "#2AAD27",
								fillOpacity: 0.1,
								radius: 1000
							}}
						></Circle>
					</LayerGroup>
				{/if}
			{/if}
		</SveafletMap>
	</div>
{/snippet}
