const database = "editor";
let idb: IDBDatabase;

export let initialized = false;

/**
 * Initializes indexeddb.
 * @returns Promise which resolves when setup completes, or rejects with the error message.
 * @example
 * await init()
 * // indexeddb code here
 */
export async function init() {
    return new Promise<void>((resolve, reject) => {
        const db = window.indexedDB.open(database, 1);
        db.onerror = e => {
            alert("indexeddb no workie :(");
            reject(db.error);
        }

        db.onsuccess = e => {
            idb = db.result;
            initialized = true;
            resolve();
        }

        db.onupgradeneeded = e => {
            if (!db.result.objectStoreNames.contains("files")) {
                db.result.createObjectStore("files", {keyPath: "name"});
            }
        }
    });
}

/**
 * Adds a file if the file doesn't exist
 * @param fileName Name of the file to add
 * @param content Content of the file
 * @returns Nothing
 */
export async function add(fileName: string, content: Uint8Array) {
    return new Promise<void>((resolve, reject) => {
        if (typeof fileName !== "string") {
            reject(new Error("No filename provided"));
            return;
        }
        if (!content) {
            reject(new Error("No content provided"));
            return;
        }

        const getRequest = idb.transaction("files", "readonly").objectStore("files").get(fileName);
        getRequest.onsuccess = () => {
            if (getRequest.result) {
                resolve();
                return;
            }

            const addRequest = idb.transaction("files", "readwrite").objectStore("files").add({ name: fileName, content: content });
            addRequest.onsuccess = () => {
                resolve();
            }
            addRequest.onerror = () => {
                reject(addRequest.error);
            }
        }
        getRequest.onerror = () => {
            reject(getRequest.error);
        }
        
        /*const res = idb.transaction("files", "readwrite").objectStore("files").add({ name: fileName, content: content });
        res.onsuccess = () => {
            resolve();
        }
        res.onerror = () => {
            console.info(res.error);
            reject(res.error);
        }*/
    });
}

/**
 * Edits/adds an IndexedDB entry.
 * @param fileName The name of the file to modify/add.
 * @param content The updated/new contents of the file.
 * @returns The error message if an error occurs.
 * @example
 * const res = insert("main.lua", filecontenthere);
 * res.then(() => {
 *     // yay
 * });
 * res.catch(e => {
 *     console.log("Indexeddb:", e, ".");
 * });
 */
export async function insert(fileName: string, content: Uint8Array) {
    return new Promise<void>((resolve, reject) => {
        if (typeof fileName !== "string") {
            reject(new Error("No filename provided"));
            return;
        }
        if (!content) {
            reject(new Error("No content provided"));
            return;
        }
        
        const res = idb.transaction("files", "readwrite").objectStore("files").put({ name: fileName, content: content });
        res.onsuccess = () => {
            resolve();
        }
        res.onerror = () => {
            reject(res.error);
        }
    });
}

/**
 * Renames a file in indexeddb.
 * @param oldName The current name of the file
 * @param newName The future name of the file
 * @returns The error message if an error occurs.
 */
export async function rename(oldName: string, newName: string) {
    return new Promise<void>((resolve, reject) => {
        const transaction = idb.transaction("files", "readwrite");
        const store = transaction.objectStore("files");

        const getOldRequest = store.get(oldName)
        getOldRequest.onsuccess = () => {
            const data = getOldRequest.result;
            if (!data) {
                reject(new Error(`File "${oldName}" not found`));
                return;
            }

            const getNewRequest = store.get(newName);
            getNewRequest.onsuccess = () => {
                if (getNewRequest.result) {
                    reject(new Error(`File "${newName}" already exists`));
                    return;
                }

                data.name = newName;

                const putRequest = store.add(data);
                putRequest.onsuccess = () => {
                    store.delete(oldName).onsuccess = () => {
                        transaction.commit();
                    }
                }
            }
        }

        transaction.onerror = () => {
            reject(transaction.error);
            return;
        }
        transaction.oncomplete = () => {
            resolve();
        }
    });
}

/**
 * Gets a file from indexeddb
 * @param file The name of the file to get
 * @returns The file data
 */
export async function read(file: string): Promise<{name: string, content: Uint8Array} | undefined> {
    return new Promise<{name: string, content: Uint8Array} | undefined>((resolve, reject) => {
        if (typeof file !== "string") {
            reject(new Error("No filename provided"));
            return;
        }
        const transaction = idb.transaction("files", "readonly");
        const store = transaction.objectStore("files");

        const getRequest = store.get(file);
        getRequest.onsuccess = () => {
            if (!getRequest.result) {
                reject(new Error(`File "${file} does not exist`));
                return;
            }
            resolve(getRequest.result);
        }

        getRequest.onerror = () => {
            reject(getRequest.error);
        }
    });
}

export async function remove(file: string) {
    return new Promise<void>((resolve, reject) => {
        if (typeof file !== "string") {
            reject(new Error("No filename provided"));
            return;
        }

        const transaction = idb.transaction("files", "readwrite");
        const store = transaction.objectStore("files");
        const removeRequest = store.delete(file);
        removeRequest.onsuccess = () => {
            resolve();
        }
        removeRequest.onerror = () => {
            reject(removeRequest.error);
        }
    });
}

export async function clear() {
    return new Promise<void>((resolve, reject) => {
        const transaction = idb.transaction("files", "readwrite");
        const store = transaction.objectStore("files");
        const removeRequest = store.clear();
        removeRequest.onsuccess = () => {
            resolve();
        }
        removeRequest.onerror = () => {
            reject(removeRequest.error);
        }
    });
}

export async function getAll(includeContent = false) {
    return new Promise<string[] | {name: string, content: Uint8Array}[] | undefined>((resolve, reject) => {
        const transaction = idb.transaction("files", "readonly");
        const store = transaction.objectStore("files");
        if (includeContent) {
            const getRequest = store.getAll();
            getRequest.onsuccess = () => {
                resolve(getRequest.result as {name: string, content: Uint8Array}[]);
            }
            getRequest.onerror = () => {
                reject(getRequest.error);
                return;
            }
        } else {
            const getRequest = store.getAllKeys();
            getRequest.onsuccess = () => {
                resolve(getRequest.result as string[]);
            }
            getRequest.onerror = () => {
                reject(getRequest.error);
                return;
            }
        }
    });
}

export async function getFolderItems(folderName: string, deep: boolean = false) {
    let prefix: string;
    if (folderName.trim() == "") {
        prefix = "";
    } else {
        prefix = folderName.endsWith("/") ? folderName : folderName + "/";
    }
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    return new Promise<string[] | undefined>((resolve, reject) => {
        const transaction = idb.transaction("files", "readonly");
        const store = transaction.objectStore("files");
        const getRequest = store.getAllKeys(range);
        getRequest.onsuccess = () => {
            const keys = getRequest.result as string[];
            if (deep) {
                resolve(keys);
            } else {
                resolve(keys.filter(file => {
                    const relativePath = file.slice(prefix.length);
                    return !relativePath.includes("/");
                }));
            }
        }
        getRequest.onerror = () => {
            reject(getRequest.error);
            return;
        }
    });
}

export async function removeFolder(folderName: string) {
    const range = IDBKeyRange.bound(folderName, folderName + "\uffff");

    return new Promise<void>((resolve, reject) => {
        const transaction = idb.transaction("files", "readwrite");
        const store = transaction.objectStore("files");
        const deleteRequest = store.delete(range);

        deleteRequest.onsuccess = () => {
            resolve();
        }
        deleteRequest.onerror = () => {
            reject(deleteRequest.error);
            return;
        }
    });
}

/**
 * 
 * @param folderName folder name should NOT end with "/"
 */
export async function createFolder(folderName: string) {
    console.debug(`(idb) Creating folder: ${folderName}`);
    await insert(folderName + "/.keep", new Uint8Array());
}

export async function renameFolder(oldName: string, newName: string) {
    console.debug(`Old name: ${oldName}\nNew name: ${newName}`);
    return new Promise<void>((resolve, reject) => {
        const oldPrefix = oldName.endsWith("/") ? oldName : oldName + "/";
        const newPrefix = newName.endsWith("/") ? newName : newName + "/";
        if (oldPrefix === newPrefix) {
            resolve();
            return;
        }

        const query = IDBKeyRange.bound(oldPrefix, oldPrefix + "\uffff");

        const transaction = idb.transaction("files", "readwrite");
        const store = transaction.objectStore("files");
        const getRequest = store.getAll(query);

        getRequest.onsuccess = () => {
            const files = getRequest.result as {name: string, content: Uint8Array}[];
            console.debug("Renaming")
            for (const file of files) {
                const oldName = file.name;
                const relativePath = file.name.slice(oldPrefix.length);
                const newPath = newPrefix + relativePath;
                console.debug(`File: ${file.name}\nRPath: ${relativePath}\nNewpath: ${newPath}\nNewPrevix: ${newPrefix}`)
                file.name = newPath;

                store.add(file);
                store.delete(oldName);
            }
        }

        getRequest.onerror = () => {
            reject(getRequest.error);
            return;
        }

        transaction.oncomplete = () => {
            resolve();
        }
        transaction.onerror = () => {
            reject(transaction.error);
            return;
        }
    });
}