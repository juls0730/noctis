export enum MessageType {
    // chat packets
    TEXT = 0,
    // user offers to send a file
    FILE_OFFER = 1,
    // user downloads a file offered by the peer
    FILE_REQUEST = 2,

    // file packets
    FILE = 3,

    ERROR = 255
}

export type Message =
    | TextMessage
    | FileOfferMessage
    | FileRequestMessage
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
        fileName: string;
        fileSize: number;
        // randomly generated to identify the file so that multiple files with the same name can be uploaded
        id: string;
    };
}

export interface FileRequestMessage extends BaseMessage {
    type: MessageType.FILE_REQUEST;
    data: {
        id: string;
    };
}

// ----- file packets -----
export interface FileMessage extends BaseMessage {
    type: MessageType.FILE;
    data: {
        id: string;
        fileName: string;
        fileSize: number;
        data: ArrayBuffer;
    };
}

export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR;
    data: string;
}