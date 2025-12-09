import mineflayer from "mineflayer";
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const OPERATOR = "eepyalex";

const openrouter = createOpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: process.env.OPENROUTER_API_KEY,
});

const bot = mineflayer.createBot({
	host: "poopy.podikoglou.eu",
	username: "Claude",
	auth: "offline",
});

// Track the target player for looking
let target: mineflayer.Entity | null = null;

// Define all available tools
const botTools = {
	chat: tool({
		description: "Send a chat message in the Minecraft server",
		parameters: z.object({
			message: z.string().describe("The message to send in the chat"),
		}),
		execute: async ({ message }) => {
			bot.chat(message);
			return { success: true, message };
		},
	}),

	// Movement controls
	setMovement: tool({
		description:
			"Set a movement control state. Use this to move the bot in a direction.",
		parameters: z.object({
			direction: z
				.enum(["forward", "back", "left", "right", "sprint", "jump"])
				.describe("The direction to move"),
			enabled: z
				.boolean()
				.describe("Whether to enable or disable this movement"),
		}),
		execute: async ({ direction, enabled }) => {
			bot.setControlState(direction, enabled);
			return { success: true, direction, enabled };
		},
	}),

	stopMovement: tool({
		description: "Stop all movement. Clears all control states.",
		parameters: z.object({}),
		execute: async () => {
			bot.clearControlStates();
			return { success: true, message: "All movement stopped" };
		},
	}),

	jump: tool({
		description: "Make the bot jump once",
		parameters: z.object({}),
		execute: async () => {
			bot.setControlState("jump", true);
			setTimeout(() => bot.setControlState("jump", false), 100);
			return { success: true, message: "Jumped!" };
		},
	}),

	// Combat
	attack: tool({
		description: "Attack the nearest entity",
		parameters: z.object({}),
		execute: async () => {
			const entity = bot.nearestEntity();
			if (entity) {
				bot.attack(entity);
				return {
					success: true,
					message: `Attacked ${entity.name || "entity"}`,
				};
			}
			return { success: false, message: "No nearby entities to attack" };
		},
	}),

	// Vehicle controls
	mount: tool({
		description: "Mount the nearest minecart or rideable entity",
		parameters: z.object({
			entityType: z
				.string()
				.optional()
				.describe(
					"The type of entity to mount (e.g., 'minecart', 'horse', 'pig'). If not specified, mounts the nearest minecart."
				),
		}),
		execute: async ({ entityType = "minecart" }) => {
			const entity = bot.nearestEntity(
				(e) => e.name === entityType || e.displayName === entityType
			);
			if (entity) {
				bot.mount(entity);
				return { success: true, message: `Mounting ${entity.displayName}` };
			}
			return { success: false, message: `No nearby ${entityType} found` };
		},
	}),

	dismount: tool({
		description: "Dismount from the current vehicle",
		parameters: z.object({}),
		execute: async () => {
			bot.dismount();
			return { success: true, message: "Dismounted" };
		},
	}),

	moveVehicle: tool({
		description: "Move the vehicle the bot is currently riding",
		parameters: z.object({
			sideways: z
				.number()
				.describe(
					"Sideways movement: positive for left, negative for right (range: -1 to 1)"
				),
			forward: z
				.number()
				.describe(
					"Forward/backward movement: positive for forward, negative for backward (range: -1 to 1)"
				),
		}),
		execute: async ({ sideways, forward }) => {
			bot.moveVehicle(sideways, forward);
			return { success: true, sideways, forward };
		},
	}),

	// Information
	getPosition: tool({
		description: "Get the bot's current position in the world",
		parameters: z.object({}),
		execute: async () => {
			const pos = bot.entity.position;
			return {
				success: true,
				x: pos.x,
				y: pos.y,
				z: pos.z,
				formatted: pos.toString(),
			};
		},
	}),

	getRotation: tool({
		description: "Get the bot's current yaw and pitch (where it's looking)",
		parameters: z.object({}),
		execute: async () => {
			return {
				success: true,
				yaw: bot.entity.yaw,
				pitch: bot.entity.pitch,
			};
		},
	}),

	lookAtPlayer: tool({
		description: "Start looking at a specific player",
		parameters: z.object({
			playerName: z.string().describe("The name of the player to look at"),
		}),
		execute: async ({ playerName }) => {
			const player = bot.players[playerName];
			if (player && player.entity) {
				target = player.entity;
				return { success: true, message: `Now looking at ${playerName}` };
			}
			return { success: false, message: `Player ${playerName} not found` };
		},
	}),

	stopLooking: tool({
		description: "Stop tracking/looking at the current target",
		parameters: z.object({}),
		execute: async () => {
			target = null;
			return { success: true, message: "Stopped looking at target" };
		},
	}),

	getNearbyEntities: tool({
		description: "Get a list of nearby entities",
		parameters: z.object({}),
		execute: async () => {
			const entities = Object.values(bot.entities)
				.filter((e) => e !== bot.entity)
				.slice(0, 10)
				.map((e) => ({
					name: e.name,
					displayName: e.displayName,
					type: e.type,
					distance: e.position.distanceTo(bot.entity.position),
				}));
			return { success: true, entities };
		},
	}),

	getPlayers: tool({
		description: "Get a list of online players",
		parameters: z.object({}),
		execute: async () => {
			const players = Object.keys(bot.players);
			return { success: true, players };
		},
	}),

	getHealth: tool({
		description: "Get the bot's current health and food level",
		parameters: z.object({}),
		execute: async () => {
			return {
				success: true,
				health: bot.health,
				food: bot.food,
				saturation: bot.foodSaturation,
			};
		},
	}),

	listTools: tool({
		description:
			"List all available tools and their descriptions. Use this when the user asks what you can do or what tools you have.",
		parameters: z.object({}),
		execute: async () => {
			const toolList = [
				"chat - Send a chat message",
				"setMovement - Move in a direction (forward, back, left, right, sprint, jump)",
				"stopMovement - Stop all movement",
				"jump - Jump once",
				"attack - Attack nearest entity",
				"mount - Mount a vehicle/entity",
				"dismount - Dismount from vehicle",
				"moveVehicle - Control vehicle movement",
				"getPosition - Get current position",
				"getRotation - Get yaw and pitch",
				"lookAtPlayer - Look at a specific player",
				"stopLooking - Stop tracking target",
				"getNearbyEntities - List nearby entities",
				"getPlayers - List online players",
				"getHealth - Get health and food levels",
				"eval - Execute arbitrary mineflayer JavaScript code with access to bot",
				"listTools - Show this list",
			];
			return { success: true, tools: toolList };
		},
	}),

	eval: tool({
		description:
			"Execute arbitrary JavaScript/mineflayer code. You have access to the 'bot' variable (mineflayer bot instance). Use this for advanced operations not covered by other tools. The code can be async. Returns the result of the last expression.",
		parameters: z.object({
			code: z
				.string()
				.describe(
					"The JavaScript code to execute. Has access to 'bot' (mineflayer instance). Can use await for async operations."
				),
		}),
		execute: async ({ code }) => {
			try {
				// Create an async function to allow await in the code
				const asyncFn = new Function(
					"bot",
					`return (async () => { ${code} })()`
				);
				const result = await asyncFn(bot);
				return {
					success: true,
					result: result !== undefined ? String(result) : "undefined",
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	}),
};

// Generate tool descriptions for the system prompt
const toolDescriptions = Object.entries(botTools)
	.map(([name, t]) => `- ${name}: ${t.description}`)
	.join("\n");

bot.on("chat", async (username, message) => {
	if (username === bot.username) return;

	if (username === OPERATOR && message.startsWith("@claude")) {
		const prompt = message.slice(7).trim(); // Remove "@claude" prefix
		if (!prompt) return;

		try {
			const result = await generateText({
				model: openrouter("anthropic/claude-sonnet-4"),
				system: `You are Claude, a helpful AI assistant controlling a Minecraft bot. Keep responses concise and friendly.

You have access to the following tools:
${toolDescriptions}

IMPORTANT: You MUST use the chat tool to respond to the player. Never respond without using the chat tool.
When the user asks what tools you have or what you can do, use the listTools tool first, then use the chat tool to tell them the result.`,
				prompt: `Player ${username} said: ${prompt}

Remember: You MUST use the chat tool to respond.`,
				tools: botTools,
				toolChoice: "required",
				maxSteps: 10,
			});

			// Fallback: if somehow no chat was sent, send the text response
			if (result.text && !result.steps.some(step => step.toolCalls.some(tc => tc.toolName === "chat"))) {
				bot.chat(result.text.slice(0, 256));
			}
		} catch (error) {
			console.error("AI error:", error);
			bot.chat("Sorry, I encountered an error processing that request.");
		}
	}
});

// Watch target - look at the tracked player
bot.once("spawn", () => {
	setInterval(() => {
		if (target) {
			bot.lookAt(target.position.offset(0, target.height, 0));
		}
	}, 50);
});

bot.on("mount", () => {
	bot.chat(`Mounted ${bot.vehicle?.displayName}`);
});

bot.on("dismount", (vehicle) => {
	bot.chat(`Dismounted ${vehicle.displayName}`);
});

bot.on("kicked", console.log);
bot.on("error", console.log);
