// nodejs like buffer class for browser
export class WebBuffer {
    private data: Uint8Array<ArrayBuffer>;
    // the number of bytes read from the buffer, this allows for you to read the buffer without having to specify the offset every time
    private count = 0;
    private dataView: DataView;

    constructor(data: ArrayBuffer) {
        this.data = new Uint8Array(data);
        this.dataView = new DataView(data);

        return new Proxy(this, {
            get(target, prop, receiver) {
                // Check if the property is a string that represents a valid number (array index)
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop, 10);
                    // Delegate array-like access to the underlying Uint8Array
                    return target.data[index];
                }
                // For all other properties (methods like slice, getters like length, etc.),
                // use the default property access behavior on the target object.
                return Reflect.get(target, prop, receiver);
            },
            set(target, prop, value, receiver) {
                // Check if the property is a string that represents a valid number (array index)
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop, 10);
                    // Delegate array-like assignment to the underlying Uint8Array
                    target.data[index] = value;
                    return true; // Indicate success
                }
                // For all other properties, use the default property assignment behavior.
                return Reflect.set(target, prop, value, receiver);
            }
        });
    }

    [index: number]: number;

    get length(): number {
        return this.data.length;
    }

    get buffer(): ArrayBuffer {
        return this.data.buffer;
    }

    slice(start: number, end?: number): WebBuffer {
        return new WebBuffer(this.data.slice(start, end).buffer);
    }

    set(data: number, offset: number) {
        this.dataView.setUint8(offset, data);
        // this.data.set(data, offset);
    }

    read(length?: number, offset?: number): Uint8Array {
        if (length === undefined) {
            length = this.length - this.count;
        }

        if (offset === undefined) {
            offset = this.count;
            this.count += length;
        }

        return this.data.slice(offset, offset + length);
    }

    write(data: Uint8Array, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += data.byteLength;
        }

        for (let i = 0; i < data.byteLength; i++) {
            this.dataView.setUint8(offset + i, data[i]);
        }
    }

    readInt8(offset?: number): number {
        if (offset === undefined) {
            offset = this.count;
            this.count += 1;
        }

        return this.dataView.getUint8(offset);
    }

    writeInt8(value: number, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += 1;
        }

        this.dataView.setUint8(offset, value);
    }

    readInt16LE(offset?: number): number {
        if (offset === undefined) {
            offset = this.count;
            this.count += 2;
        }

        return this.dataView.getInt16(offset, true);
    }

    writeInt16LE(value: number, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += 2;
        }

        this.dataView.setInt16(offset, value, true);
    }

    readInt32LE(offset?: number): number {
        if (offset === undefined) {
            offset = this.count;
            this.count += 4;
        }

        return this.dataView.getInt32(offset, true);
    }

    writeInt32LE(value: number, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += 4;
        }

        this.dataView.setInt32(offset, value, true);
    }

    readBigInt64LE(offset?: number): bigint {
        if (offset === undefined) {
            offset = this.count;
            this.count += 8;
        }

        return this.dataView.getBigInt64(offset, true);
    }

    writeBigInt64LE(value: bigint, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += 8;
        }

        this.dataView.setBigInt64(offset, value, true);
    }

    readString(offset?: number): string {
        if (offset === undefined) {
            offset = this.count;
        }

        let stringBytes = [];
        let stringLength = 0;
        // loop until we find a null byte
        while (this.data.length >= offset + stringLength && this.data[offset + stringLength] !== 0) {
            stringBytes.push(this.data[offset + stringLength]);
            stringLength++;
        }

        this.count += stringLength + 1;

        console.log("Read string:", stringBytes, stringLength);

        let textDeccoder = new TextDecoder();
        let value = textDeccoder.decode(new Uint8Array(stringBytes));

        return value;
    }

    writeString(value: string, offset?: number) {
        if (offset === undefined) {
            offset = this.count;
            this.count += value.length + 1;
        }

        // use C-style string termination
        value = value + "\0";

        let textEncoder = new TextEncoder();
        let textBuf = textEncoder.encode(value);

        console.log("Writing string:", value, textBuf);

        this.data.set(textBuf, offset);
    }

    // lets you peek at the next byte without advancing the read pointer
    peek(): number {
        return this.data[this.count];
    }

    [Symbol.iterator]() {
        // Return an iterator over the values of the underlying Uint8Array
        return this.data.values();
    }

    // Optional: Add Symbol.toStringTag for better console output
    get [Symbol.toStringTag]() {
        return 'WebBuffer';
    }
}