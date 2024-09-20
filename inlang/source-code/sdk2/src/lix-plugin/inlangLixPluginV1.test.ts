/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect, describe } from "vitest";
import { inlangLixPluginV1 } from "./inlangLixPluginV1.js";
import { type DiffReport } from "@lix-js/sdk";
import { newProject } from "../project/newProject.js";
import { loadProjectInMemory } from "../project/loadProjectInMemory.js";
import { contentFromDatabase } from "sqlite-wasm-kysely";
import type { Variant } from "../database/schema.js";

describe("plugin.diff.file", () => {
	test("insert of bundle", async () => {
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("bundle")
			.values({
				id: "1",
			})
			.execute();
		const path = "/db.sqlite";
		const diffReports = await inlangLixPluginV1.diff.file!({
			old: undefined,
			neu: {
				id: "uuid",
				path,
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});
		expect(diffReports).toEqual([
			{
				type: "bundle",
				operation: "create",
				old: undefined,
				neu: { id: "1" },
			} satisfies DiffReport,
		]);
	});

	// reanble with declarations
	test.todo("update of bundle", async () => {
		const oldProject = await loadProjectInMemory({ blob: await newProject() });
		await oldProject.db
			.insertInto("bundle")
			.values([
				{
					id: "1",
				},
				{
					id: "2",
				},
			])
			.execute();
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("bundle")
			.values([
				{
					id: "1",
				},
				{
					id: "2",
				},
			])
			.execute();

		const diffReports = await inlangLixPluginV1.diff.file!({
			old: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(oldProject._sqlite),
				metadata: {},
			},
			neu: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});

		expect(diffReports).toEqual([
			{
				meta: {
					id: "1",
				},
				type: "bundle",
				operation: "update",
				old: { id: "1" },
				neu: { id: "1" },
			} satisfies DiffReport,
		]);
	});

	test("insert of message", async () => {
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("message")
			.values({
				id: "1",
				bundleId: "unknown",
				locale: "en",
			})
			.execute();
		const diffReports = await inlangLixPluginV1.diff.file!({
			old: undefined,
			neu: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});
		expect(diffReports).toEqual([
			{
				type: "message",
				operation: "create",
				old: undefined,
				neu: {
					id: "1",
					declarations: [],
					bundleId: "unknown",
					selectors: [],
					locale: "en",
				},
			} satisfies DiffReport,
		]);
	});
	test("update of message", async () => {
		const oldProject = await loadProjectInMemory({ blob: await newProject() });
		await oldProject.db
			.insertInto("message")
			.values([
				{
					id: "1",
					bundleId: "unknown",
					locale: "en",
				},
				{
					id: "2",
					bundleId: "unknown",
					locale: "en",
				},
			])
			.execute();
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("message")
			.values([
				{
					id: "1",
					bundleId: "unknown",
					locale: "de",
				},
				{
					id: "2",
					bundleId: "unknown",
					locale: "en",
				},
			])
			.execute();
		const diffReports = await inlangLixPluginV1.diff.file!({
			old: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(oldProject._sqlite),
				metadata: {},
			},
			neu: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});
		expect(diffReports).toEqual([
			{
				meta: {
					id: "1",
				},
				type: "message",
				operation: "update",
				old: {
					id: "1",
					declarations: [],
					bundleId: "unknown",
					selectors: [],
					locale: "en",
				},
				neu: {
					id: "1",
					declarations: [],
					bundleId: "unknown",
					selectors: [],
					locale: "de",
				},
			} satisfies DiffReport,
		]);
	});
	test("insert of variant", async () => {
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("variant")
			.values({
				id: "1",
				messageId: "1",
				pattern: [{ type: "text", value: "hello world" }],
				match: {},
			})
			.execute();
		const diffReports = await inlangLixPluginV1.diff.file!({
			old: undefined,
			neu: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});
		expect(diffReports).toEqual([
			{
				type: "variant",
				operation: "create",
				old: undefined,
				neu: {
					id: "1",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world" }],
					match: {},
				},
			} satisfies DiffReport,
		]);
	});
	test("update of variant", async () => {
		const oldProject = await loadProjectInMemory({ blob: await newProject() });
		await oldProject.db
			.insertInto("variant")
			.values([
				{
					id: "1",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world" }],
					match: {},
				},
				{
					id: "2",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world" }],
					match: {},
				},
			])
			.execute();
		const neuProject = await loadProjectInMemory({ blob: await newProject() });
		await neuProject.db
			.insertInto("variant")
			.values([
				{
					id: "1",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world from Berlin" }],
					match: {},
				},
				{
					id: "2",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world" }],
					match: {},
				},
			])
			.execute();
		const diffReports = await inlangLixPluginV1.diff.file!({
			old: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(oldProject._sqlite),
				metadata: {},
			},
			neu: {
				id: "uuid",
				path: "/db.sqlite",
				data: contentFromDatabase(neuProject._sqlite),
				metadata: {},
			},
		});
		expect(diffReports).toEqual([
			{
				meta: {
					id: "1",
				},
				operation: "update",
				type: "variant",
				old: {
					id: "1",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world" }],
					match: {},
				},
				neu: {
					id: "1",
					messageId: "1",
					pattern: [{ type: "text", value: "hello world from Berlin" }],
					match: {},
				},
			} satisfies DiffReport,
		]);
	});

	// https://github.com/opral/lix-sdk/issues/33
	test("it should generate changes after the first change", async () => {
		const project = await loadProjectInMemory({ blob: await newProject() });

		const initialChanges = await project.lix.db
			.selectFrom("change")
			.selectAll()
			.execute();
		expect(initialChanges.length).toEqual(0);

		await project.db
			.insertInto("bundle")
			.values({
				id: "1",
			})
			.execute();

		// FIXME: how to await inlang sdk persisting the inlang db to lix?
		await new Promise((resolve) => setTimeout(resolve, 500));

		await project.lix.settled();

		const changes = await project.lix.db
			.selectFrom("change")
			.selectAll()
			.execute();

		expect(changes.length).toBe(1);
		expect(changes[0]?.value?.id).toBe("1");
		expect(changes[0]?.operation).toBe("create");
	});
});

describe("plugin.diff.variant", () => {
	test("old and neu are the same should not report a diff", async () => {
		const old: Variant = {
			id: "1",
			match: {},
			messageId: "5",
			pattern: [{ type: "text", value: "hello world" }],
		};
		const neu: Variant = {
			id: "1",
			match: {},
			messageId: "5",
			pattern: [{ type: "text", value: "hello world" }],
		};
		const diff = await inlangLixPluginV1.diff.variant({ old, neu });
		expect(diff).toEqual([]);
	});

	test("old and neu are different should yield a diff report", async () => {
		const old: Variant = {
			id: "1",
			match: {},
			messageId: "5",
			pattern: [{ type: "text", value: "hello world" }],
		};
		const neu: Variant = {
			id: "1",
			match: {},
			messageId: "5",
			pattern: [{ type: "text", value: "hello world from Berlin" }],
		};
		const diff = await inlangLixPluginV1.diff.variant({ old, neu });
		expect(diff).toEqual([
			{
				meta: { id: "1" },
				operation: "update",
				type: "variant",
				neu,
				old,
			} satisfies DiffReport,
		]);
	});

	test("old is undefined and neu is defined should return a diff report for the new value", async () => {
		const old = undefined;
		const neu: Variant = {
			id: "1",
			match: {},
			messageId: "5",
			pattern: [{ type: "text", value: "hello world" }],
		};
		const diff = await inlangLixPluginV1.diff.variant({ old, neu });
		expect(diff).toEqual([
			{ operation: "create", type: "variant", neu, old } satisfies DiffReport,
		]);
	});
});
