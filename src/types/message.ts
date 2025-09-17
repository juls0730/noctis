export enum MessageType {
    // chat packets
    TEXT,
    // user offers to send a file
    FILE_OFFER,
    // user downloads a file offered by the peer
    FILE_REQUEST,

    // file packets
    FILE,
    FILE_ACK,
    FILE_DONE,

    ERROR = 255
}

export type Message =
    | TextMessage
    | FileOfferMessage
    | FileRequestMessage
    | FileAckMessage
    | FileMessage
    | ErrorMessage;

interface BaseMessage {
    initiator: boolean;
}

// ----- chat packets -----
export interface TextMessage extends BaseMessage {
    type: MessageType.TEXT;
    data: string;
}

export interface FileOfferMessage extends BaseMessage {
    type: MessageType.FILE_OFFER;
    data: {
        // 64 bit file size. chunked at 1024 bytes
        fileSize: bigint;

        fileName: string;
        fileType: string;

        // 64bit randomly generated id to identify the file so that multiple files with the same name can be uploaded
        id: bigint;
        text: string | null;
        downloading?: 'preview' | 'downloading' | 'downloaded';
    };
}

export interface FileRequestMessage extends BaseMessage {
    type: MessageType.FILE_REQUEST;
    data: {
        // 64 bit file id
        id: bigint;
        // 64 bit requester id
        requesterId: bigint;
    };
}

export interface FileAckMessage extends BaseMessage {
    type: MessageType.FILE_ACK;
    // the request id
    id: bigint;
}

// ----- file packets -----
export interface FileMessage extends BaseMessage {
    type: MessageType.FILE;
    data: {
        // the request id
        id: bigint;
        // no file metadata is sent here, because we already know all of it from the request id
        // comes down in 16MB chunks
        data: Blob;
    };
}

export interface FileDoneMessage extends BaseMessage {
    type: MessageType.FILE_DONE;
    data: {
        // the request id
        id: bigint;
    };
}

export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR;
    data: string;
}