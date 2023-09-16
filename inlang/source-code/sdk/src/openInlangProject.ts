/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type {
	InlangProject,
	InstalledMessageLintRule,
	InstalledPlugin,
	Subscribable,
} from "./api.js"
import { type ImportFunction, resolveModules } from "./resolve-modules/index.js"
import { TypeCompiler } from "@sinclair/typebox/compiler"
import {
	ProjectSettingsFileJSONSyntaxError,
	ProjectSettingsFileNotFoundError,
	InvalidConfigError,
	PluginLoadMessagesError,
	PluginSaveMessagesError,
} from "./errors.js"
import { createRoot, createSignal, createEffect } from "./reactivity/solid.js"
import { createMessagesQuery } from "./createMessagesQuery.js"
import { debounce } from "throttle-debounce"
import { createMessageLintReportsQuery } from "./createMessageLintReportsQuery.js"
import { ProjectSettings, Message, type NodeishFilesystemSubset } from "./versionedInterfaces.js"
import { tryCatch, type Result } from "@inlang/result"
import { migrateIfOutdated } from "@inlang/project-settings/migration"

const ConfigCompiler = TypeCompiler.Compile(ProjectSettings)

/**
 * Creates an inlang instance.
 *
 * - Use `_import` to pass a custom import function for testing,
 *   and supporting legacy resolvedModules such as CJS.
 *
 */
export const openInlangProject = async (args: {
	settingsFilePath: string
	nodeishFs: NodeishFilesystemSubset
	_import?: ImportFunction
	_capture?: (id: string, props: Record<string, unknown>) => void
}): Promise<InlangProject> => {
	return await createRoot(async () => {
		const [initialized, markInitAsComplete, markInitAsFailed] = createAwaitable()

		// -- config ------------------------------------------------------------

		const [config, _setConfig] = createSignal<ProjectSettings>()
		createEffect(() => {
			loadConfig({ settingsFilePath: args.settingsFilePath, nodeishFs: args.nodeishFs })
				.then((config) => {
					setConfig(config)
					args._capture?.("SDK used config", config)
				})
				.catch((err) => {
					markInitAsFailed(err)
				})
		})
		// TODO: create FS watcher and update config on change

		const writeConfigToDisk = skipFirst((config: ProjectSettings) =>
			_writeConfigToDisk({ nodeishFs: args.nodeishFs, config }),
		)

		const setConfig = (config: ProjectSettings): Result<void, InvalidConfigError> => {
			try {
				const validatedConfig = parseConfig(config)
				_setConfig(validatedConfig)

				writeConfigToDisk(validatedConfig)
				return { data: undefined }
			} catch (error: unknown) {
				if (error instanceof InvalidConfigError) {
					return { error }
				}

				throw new Error("unhandled")
			}
		}

		// -- resolvedModules -----------------------------------------------------------

		const [resolvedModules, setResolvedModules] =
			createSignal<Awaited<ReturnType<typeof resolveModules>>>()

		createEffect(() => {
			const _settings = config()
			if (!_settings) return

			resolveModules({ settings: _settings, nodeishFs: args.nodeishFs, _import: args._import })
				.then((resolvedModules) => {
					setResolvedModules(resolvedModules)

					// TODO: handle `detectedLanguageTags`
				})
				.catch((err) => markInitAsFailed(err))
		})

		// -- messages ----------------------------------------------------------

		let configValue: ProjectSettings
		createEffect(() => (configValue = config()!)) // workaround to not run effects twice (e.g. config change + modules change) (I'm sure there exists a solid way of doing this, but I haven't found it yet)

		const [messages, setMessages] = createSignal<Message[]>()
		createEffect(() => {
			const conf = config()
			if (!conf) return

			const _resolvedModules = resolvedModules()
			if (!_resolvedModules) return

			if (!_resolvedModules.resolvedPluginApi.loadMessages) {
				markInitAsFailed(undefined)
				return
			}

			makeTrulyAsync(
				_resolvedModules.resolvedPluginApi.loadMessages({
					languageTags: configValue!.languageTags,
					sourceLanguageTag: configValue!.sourceLanguageTag,
				}),
			)
				.then((messages) => {
					setMessages(messages)
					markInitAsComplete()
				})
				.catch((err) =>
					markInitAsFailed(new PluginLoadMessagesError("Error in load messages", { cause: err })),
				)
		})

		// -- installed items ----------------------------------------------------

		const installedMessageLintRules = () => {
			if (!resolvedModules()) return []
			return resolvedModules()!.messageLintRules.map(
				(rule) =>
					({
						meta: rule.meta,
						module:
							resolvedModules()?.meta.find((m) => m.id.includes(rule.meta.id))?.module ??
							"Unknown module. You stumbled on a bug in inlang's source code. Please open an issue.",

						// default to warning, see https://github.com/inlang/monorepo/issues/1254
						lintLevel: configValue["messageLintRuleLevels"]?.[rule.meta.id] ?? "warning",
					} satisfies InstalledMessageLintRule),
			) satisfies Array<InstalledMessageLintRule>
		}

		const installedPlugins = () => {
			if (!resolvedModules()) return []
			return resolvedModules()!.plugins.map((plugin) => ({
				meta: plugin.meta,
				module:
					resolvedModules()?.meta.find((m) => m.id.includes(plugin.meta.id))?.module ??
					"Unknown module. You stumbled on a bug in inlang's source code. Please open an issue.",
			})) satisfies Array<InstalledPlugin>
		}

		// -- app ---------------------------------------------------------------

		const initializeError: Error | undefined = await initialized.catch((error) => error)

		const messagesQuery = createMessagesQuery(() => messages() || [])
		const lintReportsQuery = createMessageLintReportsQuery(
			messages,
			config,
			installedMessageLintRules,
			resolvedModules,
		)

		const debouncedSave = skipFirst(
			debounce(
				500,
				async (newMessages) => {
					try {
						await resolvedModules()?.resolvedPluginApi.saveMessages({ messages: newMessages })
					} catch (err) {
						throw new PluginSaveMessagesError("Error in saving messages", {
							cause: err,
						})
					}
					if (
						newMessages.length !== 0 &&
						JSON.stringify(newMessages) !== JSON.stringify(messages())
					) {
						setMessages(newMessages)
					}
				},
				{ atBegin: false },
			),
		)

		createEffect(() => {
			debouncedSave(messagesQuery.getAll())
		})

		return {
			installed: {
				plugins: createSubscribable(() => installedPlugins()),
				messageLintRules: createSubscribable(() => installedMessageLintRules()),
			},
			errors: createSubscribable(() => [
				...(initializeError ? [initializeError] : []),
				...(resolvedModules() ? resolvedModules()!.errors : []),
				// have a query error exposed
				//...(lintErrors() ?? []),
			]),
			config: createSubscribable(() => config()),
			setConfig,
			customApi: createSubscribable(() => resolvedModules()?.resolvedPluginApi.customApi || {}),
			query: {
				messages: messagesQuery,
				messageLintReports: lintReportsQuery,
			},
		} satisfies InlangProject
	})
}

//const x = {} as InlangProject

// ------------------------------------------------------------------------------------------------

const loadConfig = async (args: {
	settingsFilePath: string
	nodeishFs: NodeishFilesystemSubset
}) => {
	const { data: configFile, error: configFileError } = await tryCatch(
		async () => await args.nodeishFs.readFile(args.settingsFilePath, { encoding: "utf-8" }),
	)
	if (configFileError)
		throw new ProjectSettingsFileNotFoundError(
			`Could not locate config file in (${args.settingsFilePath}).`,
			{
				cause: configFileError,
			},
		)

	const json = tryCatch(() => JSON.parse(configFile!))

	if (json.error) {
		throw new ProjectSettingsFileJSONSyntaxError(`The config is not a valid JSON file.`, {
			cause: json.error,
		})
	}
	return parseConfig(json.data)
}

const parseConfig = (config: unknown) => {
	const withMigration = migrateIfOutdated(config as any)
	if (ConfigCompiler.Check(withMigration) === false) {
		const typeErrors = [...ConfigCompiler.Errors(config)]
		if (typeErrors.length > 0) {
			throw new InvalidConfigError(`The config is invalid according to the schema.`, {
				cause: typeErrors,
			})
		}
	}
	return withMigration
}

const _writeConfigToDisk = async (args: {
	nodeishFs: NodeishFilesystemSubset
	config: ProjectSettings
}) => {
	const { data: serializedConfig, error: serializeConfigError } = tryCatch(() =>
		// TODO: this will probably not match the original formatting
		JSON.stringify(args.config, undefined, 2),
	)
	if (serializeConfigError) throw serializeConfigError

	const { error: writeConfigError } = await tryCatch(async () =>
		args.nodeishFs.writeFile("./project.inlang.json", serializedConfig!),
	)
	if (writeConfigError) throw writeConfigError
}

// ------------------------------------------------------------------------------------------------

const createAwaitable = () => {
	let resolve: () => void
	let reject: () => void

	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	return [promise, resolve!, reject!] as [
		awaitable: Promise<void>,
		resolve: () => void,
		reject: (e: unknown) => void,
	]
}

// ------------------------------------------------------------------------------------------------

// TODO: create global util type
type MaybePromise<T> = T | Promise<T>

const makeTrulyAsync = <T>(fn: MaybePromise<T>): Promise<T> => (async () => fn)()

// Skip initial call, eg. to skip setup of a createEffect
function skipFirst(func: (args: any) => any) {
	let initial = false
	return function (...args: any) {
		if (initial) {
			// @ts-ignore
			return func.apply(this, args)
		}
		initial = true
	}
}

export function createSubscribable<T>(signal: () => T): Subscribable<T> {
	return Object.assign(signal, {
		subscribe: (callback: (value: T) => void) => {
			createEffect(() => {
				callback(signal())
			})
		},
	})
}
