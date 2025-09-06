type LiveMapEntry<K, V> = V & { key: K; value: V; };

export class LiveMap<K, V extends Object> {
    _map = new Map();

    set(key: K, value: V): LiveMapEntry<K, V> {
        if (this._map.has(key)) {
            throw new Error(`Key ${key} already exists in the map`);
        }

        this._map.set(key, value);

        // Create a wrapper object that holds both key and value for easy access, with mutation handling
        let currentValueInMap: V = value;
        const mapRef = this._map;
        // use a dummy target object to proxy the value
        const obj = new Proxy({}, {
            get(target: object, prop: string | symbol, receiver: any): any {
                if (prop === "key") {
                    return key;
                }
                if (prop === "value") {
                    return value;
                }

                return Reflect.get(currentValueInMap as object, prop, receiver);
            },
            set(target, prop, newValue) {
                if (prop === "value") {
                    value = newValue;
                    mapRef.set(key, value);
                    return true;
                }
                return Reflect.set(target, prop, newValue);
            },
            deleteProperty(target: object, prop: string | symbol): boolean {
                if (prop === "key" || prop === "value") {
                    return false; // Prevent deleting special properties
                }
                return Reflect.deleteProperty(currentValueInMap as object, prop);
            },
            has(target: object, prop: string | symbol): boolean {
                if (prop === "key" || prop === "value") {
                    return true;
                }
                return Reflect.has(currentValueInMap as object, prop);
            },
            ownKeys(target: object): Array<string | symbol> {
                const keys = Reflect.ownKeys(currentValueInMap as object);
                // Ensure 'key' and 'value' are always present when iterating over properties
                if (!keys.includes("key")) keys.push("key");
                if (!keys.includes("value")) keys.push("value");
                return keys;
            }
        }) as LiveMapEntry<K, V>;

        return obj;
    }
    get(key: K): V | undefined {
        return this._map.get(key);
    }
    delete(key: K): boolean {
        return this._map.delete(key);
    }
}