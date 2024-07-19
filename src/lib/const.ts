// * TASKS

import type { valueof } from "./types"

export const category_coins = {
	relative: 40,
	radar: 30,
	photos: 15,
	oddball: 10,
	precision: 10
} as const

export const radars = [
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
] as const

export const radar_meters = {
	radar5: 5,
	radar10: 10,
	radar25: 25,
	radar50: 50,
	radar100: 100,
	radar200: 200,
	radar500: 500,
	radar1000: 1000,
	radar2000: 2000,
	radar5000: 5000
} as const

export const task_categories = {
	relative1: "relative",
	relative2: "relative",
	radar5: "radar",
	radar10: "radar",
	radar25: "radar",
	radar50: "radar",
	radar100: "radar",
	radar200: "radar",
	radar500: "radar",
	radar1000: "radar",
	radar2000: "radar",
	radar5000: "radar",
	photos1: "photos",
	photos2: "photos",
	oddball1: "oddball",
	oddball2: "oddball",
	precision1: "precision",
	precision2: "precision"
} as const satisfies Record<string, keyof typeof category_coins>

export const task_names: Record<keyof typeof task_categories, string> = {
	relative1: "Relative 1",
	relative2: "Relative 2",
	radar5: "Radar 5m",
	radar10: "Radar 10m",
	radar25: "Radar 25m",
	radar50: "Radar 50m",
	radar100: "Radar 100m",
	radar200: "Radar 200m",
	radar500: "Radar 500m",
	radar1000: "Radar 1km",
	radar2000: "Radar 2km",
	radar5000: "Radar 5km",
	photos1: "Photos 1",
	photos2: "Photos 2",
	oddball1: "Oddball 1",
	oddball2: "Oddball 2",
	precision1: "Precision 1",
	precision2: "Precision 2"
}
export const task_descriptions: Partial<Record<keyof typeof task_categories, string>> = {}

// * CURSES

export const dice_coins = 50

export const dice_curses = {
	1: "curse01",
	2: "curse02",
	3: "curse03",
	4: "curse04",
	5: "curse05",
	6: "curse06",
	7: "curse07",
	8: "curse08",
	9: "curse09",
	10: "curse10",
	11: "curse11",
	12: "curse12",
	13: "curse13",
	14: "curse14",
	15: "curse15",
	16: "curse16",
	17: "curse17",
	18: "curse18",
	19: "curse19",
	20: "curse20",
	21: "curse21",
	22: "curse22",
	23: "curse23",
	24: "curse24"
} as const

export const curse_names: Record<valueof<typeof dice_curses>, string> = {
	curse01: "Curse 01",
	curse02: "Curse 02",
	curse03: "Curse 03",
	curse04: "Curse 04",
	curse05: "Curse 05",
	curse06: "Curse 06",
	curse07: "Curse 07",
	curse08: "Curse 08",
	curse09: "Curse 09",
	curse10: "Curse 10",
	curse11: "Curse 11",
	curse12: "Curse 12",
	curse13: "Curse 13",
	curse14: "Curse 14",
	curse15: "Curse 15",
	curse16: "Curse 16",
	curse17: "Curse 17",
	curse18: "Curse 18",
	curse19: "Curse 19",
	curse20: "Curse 20",
	curse21: "Curse 21",
	curse22: "Curse 22",
	curse23: "Curse 23",
	curse24: "Curse 24"
}
export const curse_descriptions: Partial<Record<valueof<typeof dice_curses>, string>> = {}
