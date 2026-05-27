import * as idb from "./idb";
import "./notifications";
import { sendNotification } from "./notifications";

let explorerDiv: HTMLDivElement | undefined;
let newFileBtn: HTMLButtonElement | undefined;
let newFolderBtn: HTMLButtonElement | undefined;
let uploadBtn: HTMLButtonElement | undefined;

let contextMenu: HTMLDivElement;

let onOpen = (content: Uint8Array, filename: string) => {
	return;
};

export function getFileExtension(fileName: string) {
	return fileName.match(/\.(\w*)$/)?.[1];
}
function getFileName(fileName: string) {
	return fileName.match(/[\w.]+\/?$/)?.[0];
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
	if (!oldPath) {
		sendNotification("File name data tag not found");
		return;
	}

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

function deleteFolder(element: HTMLDivElement) {
	const folderName = element.querySelector(":scope > .folder-content")?.getAttribute("data-folderpath");
	if (!folderName) {
		sendNotification("Could not delete folder cuz it doesn't exist???");
		return;
	}

	idb.removeFolder(folderName).then(() => {
		element.remove();
	}).catch(reason => {
		sendNotification(`Could not delete folder ${folderName}: ${reason}`);
	});
}

function renameFolder(element: HTMLDivElement) {
	const oldPath = element.querySelector(":scope > .folder-content")?.getAttribute("data-folderpath");
	if (!oldPath) {
		sendNotification("Folder name data tag not found");
		return;
	}

	const regexResult = oldPath.match(/([\w\/]*?)([\w]*)\/$/);
	const oldStartingPath = regexResult?.[1];
	const oldRelativePath = regexResult?.[2]; // doesent include the trailing slash

	let promptResult = prompt("New name", oldRelativePath);
	if (!promptResult || promptResult.trim() == "") return;
	promptResult = promptResult.endsWith("/") ? promptResult : promptResult + "/";
	if (promptResult == oldRelativePath || promptResult + "/" == oldRelativePath || promptResult == oldRelativePath + "/") return;

	console.debug(regexResult)

	const newName = oldStartingPath + promptResult;

	const renamePromise = idb.renameFolder(oldPath, newName);

	const headerDiv = element.querySelector(":scope > div:not(.folder-content)");
	headerDiv!.textContent = getFileName(newName)!; // theres an exclamation mark here cuz im too lazy to check if its null or not, it should never be null so its fine, right?
	
	const img = document.createElement("img");
	img.src = `https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/folder.svg`;
	headerDiv!.prepend(img);

	renamePromise.catch(reason => {
		headerDiv!.textContent = oldPath;
		const img = document.createElement("img");
		img.src = `https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/folder.svg`;
		headerDiv!.prepend(img);

		sendNotification(`Could not rename folder ${oldPath}: ${reason}`);
		console.error(reason);
	});
}

function createFolder(startingElement: HTMLDivElement) {
	let promptResult = prompt("Enter folder name:");
	if (!promptResult || promptResult.trim() == "") return;

	promptResult = promptResult.replace(/\/{2,}$/, ""); // remove trailing slashes
	if (promptResult.includes("/")) {
		sendNotification("Folder name cannot contain slashes");
		return;
	}
	if (promptResult.search(/[\w\/]/)) {
		sendNotification("Folder name contains malformed characters");
		return;
	}

	const startingPath = startingElement.querySelector(":scope > .folder-content")?.getAttribute("data-folderpath") || "";
	console.debug(`Creating folder with starting path: ${startingPath}`);

	idb.createFolder(startingPath + promptResult).then(() => {
		const newFolderElement = createFolderElement(startingPath + promptResult);
		startingElement.append(newFolderElement!);
	}).catch(reason => {
		sendNotification(`Could not create folder ${startingPath + promptResult}: ${reason}`);
		console.error(reason);
	});
}
function createFile(parentElement?: HTMLDivElement) {
	let fileName = prompt("Enter file name:");
	if (parentElement) {
		let prefix = parentElement.querySelector(":scope > .folder-content")?.getAttribute("data-folderpath");
		if (prefix) {
			fileName = prefix + fileName;
		}
	}
	if (fileName) {
		idb.add(fileName, new Uint8Array()).then(() => {
			let parentFolder = createFolderTreeForFile(fileName);
			if (parentFolder) {
				parentFolder.append(createFileElement(fileName)!);
			} else {
				explorerDiv?.appendChild(createFileElement(fileName)!);
			}
		}).catch(reason => {
			sendNotification(`Could not create file ${fileName}: ${reason}`);
		});
	}
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

	if (name.endsWith(".keep")) {
		fileElement.style.height = "0px";
		fileElement.style.boxSizing = "border-box";
		fileElement.style.margin = "0px";
		fileElement.style.padding = "0px";
		fileElement.innerText = "";
	} else {
		fileElement.addEventListener("click", () => {
			idb.read(name).then(result => {
				onOpen(result!.content, result!.name);
			}).catch((reason) => {
				sendNotification(`Failed to open file: ${reason}`);
			});
		});
	}

	return fileElement;
}

function createFolderElement(name: string, displayName?: string) {
	if (getFileExtension(name)) return;
	const folderElement = document.createElement("div");
	folderElement.classList.add("folder");

	const headerElement = document.createElement("div");
	headerElement.textContent = displayName || getFileName(name)!;
	headerElement.addEventListener("contextmenu", e => {
		e.preventDefault();
		showContextMenu(e.clientX, e.clientY, [
			new ContextMenuOption("Delete", name !== "main.lua", () => {deleteFolder(folderElement)}),
			new ContextMenuOption("Rename", true, () => {renameFolder(folderElement)}),
			new ContextMenuOption("New File", true, () => {createFile(folderElement)}),
			new ContextMenuOption("New Folder", true, () => {createFolder(folderElement)}),
			new ContextMenuOption("Upload File", true, () => {uploadFile(folderElement)})
		]);
	});
	folderElement.append(headerElement);

	const imgElement = document.createElement("img");
	imgElement.src = "https://raw.githubusercontent.com/dmhendricks/file-icon-vectors/refs/heads/master/dist/icons/square-o/folder.svg"
	headerElement.prepend(imgElement);

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
			const newFolderElement = createFolderElement(currentPath, folder);
			currentParent?.append(newFolderElement!);
			contentElement = newFolderElement?.querySelector(":scope > .folder-content")!;
		}

		currentParent = contentElement;
	}
	console.debug("Tree created");

	return currentParent;
}

export function uploadFile(startingElement: HTMLDivElement, files?: FileList) {
	const upload = async (files: FileList) => {
		const startingPath = startingElement.querySelector(":scope > .folder-content")?.getAttribute("data-folderpath") || "";
		const contentElem = startingElement.querySelector(":scope > .folder-content");
		for (let i = 0; i < files.length; i++) {
			const file = files.item(i)!;
			idb.add(startingPath + file.name, await file.bytes()).then(() => {
				contentElem?.prepend(createFileElement(startingPath + file.name));
			}).catch(e => {
				console.error(e);
				sendNotification("Failed to upload file: " + e);
			});
		}
	}
	if (!files) {
		const newInput = document.createElement("input");
		newInput.type = "file";
		newInput.multiple = true;
		newInput.addEventListener("change", () => {
			if (newInput.files) {
				files = newInput.files;
				newInput.remove();
				upload(files);
				return;
			}
		});
		newInput.addEventListener("cancel", () => {
			newInput.remove();
			return;
		});
		newInput.click();
	} else {
		upload(files);
	}
}

export async function init(eDiv: HTMLDivElement, nFileBtn: HTMLButtonElement, nFolderBtn: HTMLButtonElement, uFileBtn: HTMLButtonElement, openFileCallback: (content: Uint8Array, filename: string) => void) {
	explorerDiv = eDiv;
	newFileBtn = nFileBtn;
	newFolderBtn = nFolderBtn;
	uploadBtn = uFileBtn;

	onOpen = openFileCallback;

	uploadBtn.addEventListener("click", () => {
		uploadFile(eDiv);
	});

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
		if (file == ".keep") continue;
		let parentFolder = createFolderTreeForFile(file as string);
		if (parentFolder) {
			parentFolder.append(createFileElement(file as string)!);
		} else {
			explorerDiv.append(createFileElement(file as string)!);
		}
	}

	nFileBtn.addEventListener("click", async () => {
		createFile();
	});
	
	nFolderBtn.addEventListener("click", () => {
		if (!explorerDiv) {
			sendNotification("Explorer not initialized");
			return;
		}
		createFolder(explorerDiv);
	});

	document.body.addEventListener("mousedown", () => {
		hideContextMenu();
	});

	idb.read("main.lua").then(result => {
		onOpen(result!.content, result!.name);
	}).catch((reason) => {
		sendNotification(`Failed to open file: ${reason}`);
	});
}