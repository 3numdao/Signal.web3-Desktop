export class PathName {
  orig: string;
  base: string;
  ext?: string;
  dir?: string;

  constructor(pathname: string) {
    this.orig = pathname;

    const lastSlash = pathname.lastIndexOf('/');
    if (lastSlash > -1) {
      this.base = pathname.substring(lastSlash + 1, pathname.length);
      this.dir = pathname.substring(0, lastSlash);
    } else {
      this.base = pathname;
    }

    const lastDot = pathname.lastIndexOf('.');
    if (lastDot > -1) {
      this.ext = pathname.substring(lastDot + 1, pathname.length);
    }
  }

  toString(): string {
    return this.orig;
  }
}
