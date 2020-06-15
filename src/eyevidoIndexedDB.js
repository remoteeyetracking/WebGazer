(function(window) {
    'use strict';

    var databaseObj = {
        name: 'eyevidoDB',
        objectStore: 'eyevidoObj',
        version : 3
    }

    var connectDB = (resolve, reject) => {
        return new Promise((resolve, reject) => {
            var req = window.indexedDB.open(databaseObj.name, databaseObj.version);

            req.onsuccess = (ev) => {
                databaseObj.connection = ev.target.result;
                resolve();
            };

            req.onupgradeneeded = (ev2) => {
                databaseObj.connection = ev2.target.result;
                databaseObj.init = 1;
                resolve();
            }

            req.onerror = (ev3) => {
                reject(ev3);
            }
        });
    }

    var createDB = () => {
        return new Promise((resolve, reject) => {

            if (!databaseObj.init) {
                resolve('[createDB] already initialized');
            }

            var objectStore = databaseObj.connection.createObjectStore(databaseObj.objectStore);

            objectStore.transaction.oncomplete = (e) => {
                databaseObj.connection.transaction([databaseObj.objectStore], 'readwrite').objectStore(databaseObj.objectStore);
                resolve('[createDB] task finished');
            }

            objectStore.transaction.onerror = (event) => {
                reject(event.request.errorCode);
            };
        });
    }

    window.appendDB = (json) => {
        return new Promise((resolve, reject) => {
            var trx = databaseObj.connection.transaction([databaseObj.objectStore], 'readwrite').objectStore(databaseObj.objectStore).put(json, 'data');
            resolve('[appendDB] task finished');
            trx.onerror = (e) => {
                reject(e);
            };
        });
    };

    function getJSON(resolve, reject) {
        var trx = databaseObj.connection.transaction([databaseObj.objectStore]).objectStore(databaseObj.objectStore);
        trx.openCursor().onsuccess = (res) => {
            if(res.target.result === undefined) {
                reject('[getDB] task undefined');
            }
            else {
                resolve(res.target.result);
            }
        };
        trx.onerror = (e) => {
            reject(e);
        };
    }

    window.getDB = () => {
        return new Promise((resolve, reject) => {
            if(databaseObj.connection === undefined) {
                connectDB(databaseObj).then(() => {
                    createDB(databaseObj).then((res) => {
                        getJSON(resolve, reject);
                    });
                }).catch((e) => {
                    console.log(e);
                });
            }
            else {
                getJSON(resolve, reject);
            }
        });
    };

})(window);