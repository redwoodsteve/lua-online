import * as idb from "./idb";
import "./notifications";
import { sendNotification } from "./notifications";

let explorerDiv: HTMLDivElement | undefined;
let newFileBtn: HTMLButtonElement | undefined;
let newFolderBtn: HTMLButtonElement | undefined;

let contextMenu: HTMLDivElement;

function getFileExtension(fileName: string) {
	return fileName.match(/\.(\w*)$/)?.[1];
}
function getFileName(fileName: string) {
	return fileName.match(/[\w.]+$/)?.[0];
}

function deleteFile(element: HTMLDivElement) {
	const file: string | null = element.getAttribute("data-filename");
	if (!file) return;

	const deletePromise = idb.remove(file);
	deletePromise.then(() => {
		element.remove();
	}).catch(reason => {
		sendNotification("Could not delete file: " + reason);
		console.error(reason);
	});
}

function renameFile(element: HTMLDivElement) {
	const oldPath: string | null = element.getAttribute("data-filename");
	if (!oldPath) return;

	const regexResult = oldPath.match(/^(.*\/)?(.*)/);
	const oldName: string = regexResult?.[2]!;

	const promptResult = prompt("New name", oldName)
	const newName = (regexResult?.[1] || "") + promptResult;
	if (!promptResult || newName == oldPath) return;

	const renamePromise = idb.rename(oldPath, newName);
	element.textContent = getFileName(newName)!;
	
	const img = document.createElement("img");
	img.src = `https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/${getFileExtension(promptResult)}.svg`;
	element.prepend(img);

	element.setAttribute("data-filename", newName);

	renamePromise.catch(reason => {
		element.textContent = oldPath;

		sendNotification(`Could not rename file ${oldPath}: ${reason}`);
		console.error(reason);
	});
}

class ContextMenuOption {
	label: string;
	onclick: () => void | undefined = () => {};
	enabled: boolean = true;

	/**
	 * @param label The text of the option
	 * @param onclick Function to run when option clicked
	 * @param enabled If false, option is greyed out, default true
	 */
	constructor(label: string, enabled?: boolean | undefined, onclick?: () => void | undefined) {
		this.label = label;
		if (onclick) this.onclick = onclick;
		if (typeof enabled === "boolean") {
			this.enabled = enabled;
		}
	}
}

function hideContextMenu() {
	if (contextMenu) {
		contextMenu.remove();
		contextMenu = null!;
	}
}

function showContextMenu(mx: number, my: number, options: ContextMenuOption[]) {
	hideContextMenu();
	const contextMenuElement = document.createElement("div");
	contextMenu = contextMenuElement;
	contextMenuElement.classList.add("context-menu");

	for (const option of options) {
		const optionElement = document.createElement("button");
		optionElement.type = "button";

		if (!option.enabled) {
			optionElement.disabled = true;
		}

		optionElement.textContent = option.label;

		optionElement.addEventListener("mousedown", e => {
			e.stopPropagation();
			hideContextMenu();
			option.onclick();
		});

		contextMenuElement.append(optionElement);
	}

	contextMenuElement.style.left = mx + "px";
	contextMenuElement.style.top = my + "px";

	document.body.append(contextMenuElement);
}

function createFileElement(name: string) {
	const fileElement = document.createElement("div");
	fileElement.classList.add("file");
	fileElement.textContent = getFileName(name)!;
	fileElement.setAttribute("data-filename", name);
	fileElement.addEventListener("contextmenu", e => {
		e.preventDefault();
		showContextMenu(e.clientX, e.clientY, [
			new ContextMenuOption("Rename", name !== "main.lua", () => {renameFile(fileElement)}),
			new ContextMenuOption("Delete", name !== "main.lua", () => {deleteFile(fileElement)})
		]);
	});

	const imgElement = document.createElement("img");
	const extension = getFileExtension(name);
	imgElement.src = `https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/${extension}.svg`;
	fileElement.prepend(imgElement);

	return fileElement;
}

function createFolderElement(name: string) {
	if (getFileExtension(name)) return;
	const folderElement = document.createElement("div");
	folderElement.classList.add("folder");

	const headerElement = document.createElement("div");
	headerElement.textContent = getFileName(name)!;
	headerElement.addEventListener("contextmenu", e => {
		e.preventDefault();
		showContextMenu(e.clientX, e.clientY, [
			new ContextMenuOption("Delete", name !== "main.lua", () => {deleteFile(folderElement)})
		]);
	});
	folderElement.append(headerElement);

	const imgElement = document.createElement("img");
	imgElement.src = "https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/folder.svg"
	headerElement.prepend(imgElement);

	headerElement.append(name);

	const contentElement = document.createElement("div");
	contentElement.classList.add("folder-content");
	contentElement.setAttribute("data-folderpath", name);
	folderElement.append(contentElement);

	headerElement.addEventListener("mousedown", e => {
		if (e.button !== 0) return;
		contentElement.style.display = contentElement.style.display == "none" ? "flex" : "none";
	});

	contentElement.style.display = "none"; // dont expand on creation

	return folderElement;
}

function createFolderTreeForFile(fileName: string) {
	const folders = fileName.split("/");
	if (folders[0] == "") {
		folders.shift();
	}
	if (folders.length == 1) return;

	let currentPath = "";
	let currentParent = explorerDiv;

	console.debug("Creating folder tree:", folders);
	for (let i = 0; i < folders.length - 1; i++) {
		const folder = folders[i];
		if (folder.trim() == "") return;

		console.debug(folder);
		console.debug("Parent:", currentParent);

		currentPath += folder + "/";

		// see if a folder content div already exists in this directory
		let contentElement = document.querySelector(`[data-folderpath="${currentPath}"]`) as HTMLDivElement;

		if (!contentElement) {
			const newFolderElement = createFolderElement(currentPath);
			currentParent?.append(newFolderElement!);
			contentElement = newFolderElement?.querySelector(".folder-content")!;
		}

		currentParent = contentElement;
	}
	console.debug("Tree created");

	return currentParent;
}

export async function init(eDiv: HTMLDivElement, nFileBtn: HTMLButtonElement, nFolderBtn: HTMLButtonElement) {
	explorerDiv = eDiv;
	newFileBtn = nFileBtn;
	newFolderBtn = nFolderBtn;
	let files;
	try {
		await idb.init();
		await idb.add("main.lua", new Uint8Array());
		files = await idb.getAll();
	} catch (e) {
		console.info(e);
	}
	console.debug("Files loaded from IndexedDB:", files);

	if (!files) return;

	for (const file of files) {
		let parentFolder = createFolderTreeForFile(file);
		if (parentFolder) {
			parentFolder.append(createFileElement(file));
		} else {
			explorerDiv.append(createFileElement(file));
		}
	}

	nFileBtn.addEventListener("click", async () => {
		const fileName = prompt("Enter file name:");
		if (fileName) {
			try {
				await idb.add(fileName, new Uint8Array());
				explorerDiv?.appendChild(createFileElement(fileName));
			} catch (e) {
				console.info(e);
			}
		}
	});

	document.body.addEventListener("mousedown", () => {
		hideContextMenu();
	});
}