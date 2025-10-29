export interface IGetWeiboLongTextParams {
    id: string;
    refererUid: string;
}

export interface IWeiboLongTextResponse {
    longTextContent: string;
}

export interface IGetWeiboParams {
    uid: string;
    page: number;
    feature: number;
}

export interface IWeiboPost {
    text_raw: string;
    created_at: string;
    idstr: string;
    mblogid: string;
    isLongText: boolean;
    isTop: number;
}

export interface IWeiboAPIResponse {
    list?: IWeiboPost[];
    [key: string]: any;
}
