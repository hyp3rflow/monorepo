/* eslint-disable @typescript-eslint/no-non-null-assertion */
import "./style.css"
import { createRoot } from "react-dom/client"

import { MessageBundleList } from "./messageBundleListReact.js"
import { MainView } from "./mainView.js"

import { storage } from "./storage/db-messagebundle.js"
import { pluralBundle } from "../../src/v2/mocks/index.js"
import { createMessage, createMessageBundle } from "../../src/v2/helper.js"

import "@inlang/message-bundle-component"
import { MessageBundle } from "../../src/v2/types/message-bundle.js"
import { randomHumanId } from "../../src/storage/human-id/human-readable-id.js"

import { ProjectSettings2 } from "../../src/v2/types/project-settings.js"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<div id="root"></div>`
{
	/* <div>
     <h3>MessageBundle + RxDB + SlotMaschine + Lix</h3>
     <div class="card">
      <section>
	  GitHub token: <input type="password" id="ghtoken" name="ghtoken">
	  Github repo: 
      <h2>Actions</h2>
	  <button id="btnAdd1">Add 1 Message</button>
	  <button id="btnAdd100">Add 100 Messages</button>
	  <button id="btnAdd1000">Add 1000 Messages</button><br><br>
	  <button id="commit" type="button" label="">Commit Changes</button>
	  <button id="push" type="button" label="">Push Changes</button><br>
	  
	  <br><button id="pull" type="button" label="">Pull Changes</button>
      </section>
      <section>
	  <h2>List</h2>
	  
	  <div id="messageList"></div>
      </section>
       <div id="root"></div>
     </div>
	 
</div>` */
}

const domNode = document.getElementById("root")
const root = createRoot(domNode!)
//root.render(<MessageBundleList />)
root.render(<MainView />)
// document.querySelector<HTMLButtonElement>("#pull")!.onclick = async (el) => {
// 	// @ts-expect-error
// 	el.disabled = true
// 	const s = await storage
// 	await s.pullChangesAndReloadSlots()
// 	document.querySelector<HTMLButtonElement>("#pull")!.disabled = false
// }

// document.querySelector<HTMLButtonElement>("#push")!.onclick = async function () {
// 	;(this as HTMLButtonElement).disabled = true
// 	const s = await storage
// 	await s.pushChangesAndReloadSlots()
// 	;(this as HTMLButtonElement).disabled = false
// }

// document.querySelector<HTMLButtonElement>("#commit")!.onclick = async function () {
// 	;(this as HTMLButtonElement).disabled = true
// 	const s = await storage
// 	await s.commitChanges()
// 	;(this as HTMLButtonElement).disabled = false
// }

// // TODO trigger lints when a messageBundle change is detected by adapter
// // TODO extract messageBundle<->Message join from adapter to make it availebl in linter
// // TODO trigger slotfile reload o

// storage.then(async (storage) => {
// 	// console.log("storage", storage)
// 	// const linter = await createLintWorker(storage.projectPath, [], storage.fs)
// 	// console.log("linter", linter)
// 	// const reports = await linter.lint({
// 	// 	locales: ["en", "de", "fr"],
// 	// } as ProjectSettings2)
// 	// console.log("reports host", reports)
// })

// const insertNHeros = async (n: number) => {
// 	const messagesToAdd = [] as MessageBundle[]
// 	for (let i = 0; i < n; i++) {
// 		const newMessage = createMessage({
// 			locale: "de",
// 			text: "new",
// 		})

// 		const messageBundle = createMessageBundle({
// 			alias: {},
// 			messages: [newMessage],
// 		})
// 		messagesToAdd.push(messageBundle)
// 	}

// 	const messageBundles = (await storage).inlangProject.messageBundleCollection
// 	if (n === 1) {
// 		const temp = structuredClone(pluralBundle)
// 		temp.id = randomHumanId()
// 		temp.messages[0].id = randomHumanId()
// 		temp.messages[1].id = randomHumanId()

// 		await messageBundles.insert(temp as any)
// 		return
// 	}

// 	console.time("inserting " + n + " messages")

// 	await (await storage).inlangProject.messageBundleCollection.bulkInsert(messagesToAdd)
// 	console.timeEnd("inserting " + n + " herors")
// }

// document.querySelector<HTMLButtonElement>("#btnAdd1")!.addEventListener("click", () => {
// 	insertNHeros(1)
// })
// document.querySelector<HTMLButtonElement>("#btnAdd100")!.addEventListener("click", () => {
// 	insertNHeros(100)
// })

// document.querySelector<HTMLButtonElement>("#btnAdd1000")!.addEventListener("click", () => {
// 	insertNHeros(1000)
// })