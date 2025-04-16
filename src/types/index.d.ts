declare namespace Spicetify {
  type Metadata = {
    is_local: boolean;
    is_playing: boolean;
    duration: number;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track: {
      uri: string;
      metadata: {
        artist_uri: string;
        title: string;
        artist_name: string;
        album_uri: string;
        album_title: string;
        image_url: string;
      };
    };
  };

  namespace Player {
    function addEventListener(type: string, callback: Function): void;
    function removeEventListener(type: string, callback: Function): void;
    function getCurrentTrack(): any;
    function getProgress(): number;
    function getDuration(): number;
    function getMute(): boolean;
    function getRepeat(): boolean;
    function getShuffle(): boolean;
    function getVolume(): number;
    function next(): void;
    function pause(): void;
    function play(): void;
    function playUri(uri: string): void;
    function previous(): void;
    function seek(pos: number): void;
    function setMute(state: boolean): void;
    function setRepeat(state: boolean): void;
    function setShuffle(state: boolean): void;
    function setVolume(volume: number): void;
    function togglePlay(): void;
    const data: {
      track: {
        uri: string;
        name: string;
        artists: { name: string; uri: string }[];
        album: { name: string; uri: string };
        duration: number;
      };
    };
  }

  namespace Platform {
    const History: {
      location: { pathname: string };
      listen: (callback: (location: { pathname: string }) => void) => void;
      push: (pathname: string) => void;
    };
  }

  namespace CosmosAsync {
    function get(url: string): Promise<any>;
    function post(url: string, data?: any): Promise<any>;
    function put(url: string, data?: any): Promise<any>;
    function del(url: string): Promise<any>;
  }
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.svg" {
  import * as React from "react";
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  const src: string;
  export default src;
}