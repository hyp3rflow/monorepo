import {
	Branch,
	Change,
	changeHasLabel,
	changeInBranch,
	Lix,
	Snapshot,
} from "@lix-js/sdk";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { currentBranchAtom, lixAtom } from "../state.ts";
import clsx from "clsx";
import { activeFileAtom } from "../state-active-file.ts";

const getChanges = async (
	lix: Lix,
	changeSetId: string,
	fileId: string,
	currentBranch: Branch
): Promise<
	Record<
		string,
		Array<
			Change & {
				content: Snapshot["content"];
				parent: Change & { content: Snapshot["content"] };
			}
		>
	>
> => {
	const changes = await lix.db
		.selectFrom("change")
		.innerJoin("snapshot", "snapshot.id", "change.snapshot_id")
		.innerJoin(
			"change_set_element",
			"change_set_element.change_id",
			"change.id"
		)
		.where("change_set_element.change_set_id", "=", changeSetId)
		.where("change.file_id", "=", fileId)
		.selectAll("change")
		.select("snapshot.content")
		.execute();

	// Group changes by row
	//
	// TODO this is a workaround for the fact that the changes are not groupable by row with SQL
	//
	//      this can be achieved by adding a row_entity to the snapshot but ...
	//      then the snapshot === undefined can't be used to detect a deletion.
	//
	//      1. Snapshot === undefined is not good for deletions. It is probably
	//         better to have a dedicated concept of deleted changes
	//
	//      2. The row_entity could be change metadata but what's the differenc to snapshot then?
	//
	//      3. Lix should probably have a concept of dependent changes that are linked.
	//         e.g. a row change is dependent on N cell changes via detectedChange.dependsOn: [detectedCellChange1, detectedCellChange2]
	//
	//      EDIT regarding 3:
	//      We can define an row and have as snapshot { dependsOn: [detectedCellChange1, detectedCellChange2] }
	//      before introducing a first level concept in lix. Yes, foreign keys wouldn't work but that's OK at the moment.
	const groupedByRow: any = {};

	for (const change of changes) {
		const parts = change.entity_id.split("|");
		const rowEntityId = parts[0] + "|" + parts[1];

		if (!groupedByRow[rowEntityId]) {
			groupedByRow[rowEntityId] = [];
		}
		groupedByRow[rowEntityId].push(change);
	}

	for (const id in groupedByRow) {
		const row = groupedByRow[id];
		console.log(row);

		for (const change of row) {
			const parent = await lix.db
				.selectFrom("change")
				.innerJoin("snapshot", "snapshot.id", "change.snapshot_id")
				.innerJoin(
					"change_graph_edge",
					"change_graph_edge.parent_id",
					"change.id"
				)
				.where("change_graph_edge.child_id", "=", change.id)
				.where(changeInBranch(currentBranch))
				.where(changeHasLabel("confirmed"))
				.selectAll("change")
				.select("snapshot.content")
				.executeTakeFirst();

			change.parent = parent;
		}
	}
	return groupedByRow;
};

export default function ChangeSet(props: {
	id: string;
	firstComment: string | null;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [lix] = useAtom(lixAtom);
	const [activeFile] = useAtom(activeFileAtom);
	const [changes, setChanges] = useState<
		Awaited<ReturnType<typeof getChanges>>
	>({});
	const [currentBranch] = useAtom(currentBranchAtom);

	useEffect(() => {
		if (isOpen) {
			getChanges(lix, props.id, activeFile.id, currentBranch).then((data) => {
				setChanges(data);
			});
			const interval = setInterval(async () => {
				getChanges(lix, props.id, activeFile.id, currentBranch).then(
					setChanges
				);
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [lix, activeFile, props.id]);

	return (
		<div
			className={clsx(
				"flex flex-col cursor-pointer group bg-white hover:bg-zinc-50",
				isOpen && "bg-white!"
			)}
			onClick={() => setIsOpen(!isOpen)}
		>
			<div className="flex gap-3 items-center">
				<div className="w-5 h-5 bg-zinc-100 flex items-center justify-center rounded-full ml-4">
					<div className="w-2 h-2 bg-zinc-700 rounded-full"></div>
				</div>
				<div className="flex-1 flex gap-2 items-center justify-between py-3 rounded md:h-[46px]">
					<div className="flex flex-col md:flex-row md:gap-2 md:items-center flex-1">
						<p className="text-zinc-950 text-sm! font-semibold">
							(TODO author)
						</p>
						<p className="text-sm! text-zinc-600">{props.firstComment}</p>
					</div>
					<p className="text-sm! pr-5 flex items-center gap-4 flex-1]">
						{/* {timeAgo(change.created_at)} */}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="1em"
							height="1em"
							viewBox="0 0 24 24"
							className="text-zinc-600"
						>
							<path
								fill="none"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="m4 9l8 8l8-8"
							/>
						</svg>
					</p>
				</div>
			</div>
			<div className={clsx(isOpen ? "block" : "hidden")}>
				<div className="flex flex-col gap-2 px-3 pb-3">
					{Object.keys(changes).map((rowId) => {
						const uniqueColumnValue = rowId.split("|")[1];

						// TODO: when importing new file one change contains every change of a row. When doing manual change, it contains more changes that belong to one row -> so do the grouping here when needed
						return (
							<div
								key={rowId}
								className="bg-zinc-50 border border-zinc-200 rounded-md pt-2 px-3 pb-4"
							>
								<div className="flex flex-wrap md:flex-nowrap overflow-x-scroll gap-x-1 gap-y-2 md:gap-y-8">
									<div className="flex md:flex-col items-center w-full md:w-auto">
										<p className="hidden md:block text-zinc-500 md:py-1.5 w-[140px] line-clamp-1 whitespace-nowrap text-[14px]">
											UNIQUE VALUE
										</p>
										<p className="md:px-4 md:py-1.5 md:bg-white md:border border-zinc-200 md:w-[140px] rounded-full md:mr-4 overflow-hidden whitespace-nowrap text-ellipsis">
											{uniqueColumnValue}
										</p>
									</div>
									{changes[rowId].map((change) => {
										const column = change.entity_id.split("|")[2];
										const value = change.content?.text;
										const parentValue = change.parent?.content?.text;

										const hasDiff = value !== parentValue;

										if (hasDiff === false) {
											return undefined;
										}

										return (
											<div
												key={column}
												className="flex md:flex-col flex-wrap md:flex-nowrap items-center w-full md:w-auto"
											>
												<p className="text-zinc-500 py-1 md:py-1.5 w-full md:w-[140px] uppercase text-[14px] overflow-hidden whitespace-nowrap text-ellipsis">
													{column}
												</p>
												{value ? (
													// insert or update
													<p className="px-3 py-1.5 bg-white border border-zinc-200 flex-1 md:w-[140px] overflow-hidden whitespace-nowrap text-ellipsis">
														{value}
													</p>
												) : (
													// deletion
													<p className="px-3 py-1.5 min-h-[38px] bg-zinc-100 border border-zinc-400 border-dashed flex-1 md:w-[140px]"></p>
												)}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="18"
													height="18"
													viewBox="0 0 24 24"
													className="text-zinc-400 m-1 -rotate-90 md:rotate-0"
												>
													<path
														fill="currentColor"
														d="M11 20h2V8l5.5 5.5l1.42-1.42L12 4.16l-7.92 7.92L5.5 13.5L11 8z"
													/>
												</svg>
												{parentValue ? (
													// insert or update
													<p className="px-3 py-1.5 bg-zinc-200 flex-1 md:w-[140px] overflow-hidden whitespace-nowrap text-ellipsis">
														{parentValue}
													</p>
												) : (
													// non-existent
													<p className="px-3 py-1.5 min-h-[38px] bg-zinc-100 border border-zinc-400 border-dashed flex-1 md:w-[140px]"></p>
												)}
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
