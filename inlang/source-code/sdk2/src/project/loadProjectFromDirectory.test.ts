/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "vitest";
import { ProjectSettings } from "../schema/settings.js";
import { Volume } from "memfs";
import { loadProjectFromDirectory } from "./loadProjectFromDirectory.js";
import { selectBundleNested } from "../query-utilities/selectBundleNested.js";
import type { Text } from "../schema/schemaV2.js";
import type { InlangPlugin } from "../plugin/schema.js";

test("plugin.loadMessages and plugin.saveMessages should work for legacy purposes", async () => {
	const mockLegacyPlugin: InlangPlugin = {
		key: "mock-plugin",
		loadMessages: async ({ nodeishFs, settings }) => {
			const pathPattern = settings["plugin.mock-plugin"]?.pathPattern as string;
			// @ts-expect-error - language tag is always given by the sdk v2
			for (const languageTag of settings.languageTags) {
				const data = await nodeishFs.readFile(
					pathPattern.replace("{languageTag}", languageTag)
				);
				return JSON.parse(data.toString());
			}
		},
		saveMessages: async () => {},
	};
	const mockRepo = {
		"./README.md": "# Hello World",
		"./src/index.js": "console.log('Hello World')",
		"./src/translations/en.json": JSON.stringify({
			key1: "value1",
			key2: "value2",
		}),
		"./src/translations/de.json": JSON.stringify({
			key1: "wert1",
			key2: "wert2",
		}),
		"./project.inlang/settings.json": JSON.stringify({
			baseLocale: "en",
			locales: ["en", "de"],
			modules: ["./mock-module.js"],
			"plugin.mock-plugin": {
				pathPattern: "./src/translations/{languageTag}.json",
			},
		} satisfies ProjectSettings),
	};
	const fs = Volume.fromJSON(mockRepo).promises;
	const project = await loadProjectFromDirectory({
		fs: fs as any,
		path: "./project.inlang",
	});
	const bundles = await selectBundleNested(project.db).execute();
	const bundlesOrdered = bundles.sort((a, b) =>
		a.alias["default"]!.localeCompare(b.alias["default"]!)
	);
	expect(bundles.length).toBe(2);
	expect(bundlesOrdered[0]?.alias.default).toBe("key1");
	expect(bundlesOrdered[1]?.alias.default).toBe("key2");
	expect(bundlesOrdered[0]?.messages[0]?.locale).toBe("en");
	expect(
		(bundlesOrdered[0]?.messages[0]?.variants[0]?.pattern[0] as Text)?.value
	).toBe("value1");
	expect(
		(bundlesOrdered[0]?.messages[0]?.variants[1]?.pattern[0] as Text)?.value
	).toBe("value2");

	expect(bundlesOrdered[0]?.messages[1]?.locale).toBe("de");
	expect(
		(bundlesOrdered[0]?.messages[1]?.variants[0]?.pattern[0] as Text)?.value
	).toBe("wert1");
	expect(
		(bundlesOrdered[0]?.messages[1]?.variants[1]?.pattern[0] as Text)?.value
	).toBe("wert2");
});

test("it should copy all files in a directory into lix", async () => {
	const mockSettings = {
		baseLocale: "en",
		locales: ["en", "de"],
		modules: [],
	} satisfies ProjectSettings;

	const mockDirectory = {
		"/project.inlang/cache/plugin/29j49j2": "cache value",
		"/project.inlang/.gitignore": "git value",
		"/project.inlang/prettierrc.json": "prettier value",
		"/project.inlang/README.md": "readme value",
		"/project.inlang/settings.json": JSON.stringify(mockSettings),
	};
	const fs = Volume.fromJSON(mockDirectory).promises;
	const project = await loadProjectFromDirectory({
		fs: fs as any,
		path: "/project.inlang",
	});
	const files = (
		await project.lix.db.selectFrom("file").selectAll().execute()
	).filter((file) => file.path !== "/db.sqlite");

	expect(files.length).toBe(5);

	const filesByPath = files.reduce((acc, file) => {
		acc[file.path] = new TextDecoder().decode(file.data);
		return acc;
	}, {} as any);

	expect(filesByPath["/cache/plugin/29j49j2"]).toBe("cache value");
	expect(filesByPath["/.gitignore"]).toBe("git value");
	expect(filesByPath["/prettierrc.json"]).toBe("prettier value");
	expect(filesByPath["/README.md"]).toBe("readme value");
	expect(filesByPath["/settings.json"]).toBe(JSON.stringify(mockSettings));
});