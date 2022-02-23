import * as ts from "typescript";
import path from "path";

interface Pattern {
  prefix: string;
  suffix: string;
}

export class PathResolver {
  private readonly baseUrl: string;
  private readonly paths: ts.MapLike<string[]>;
  private readonly patterns: (string | Pattern)[];

  public constructor(baseUrl: string, paths: ts.MapLike<string[]>) {
    this.baseUrl = baseUrl;
    this.paths = paths;
    this.patterns = this.parsePatterns(paths);
  }

  public resolve(fileName: string, moduleName: string) {
    if (!this.paths) return undefined;
    if (path.posix.isAbsolute(moduleName) || (process.platform == "win32" && path.win32.isAbsolute(moduleName))) return undefined;

    const matchedPattern = this.matchPatternOrExact(moduleName);
    if (!matchedPattern) return undefined;

    const matchedStar = typeof matchedPattern === "string" ? undefined : moduleName.substring(matchedPattern.prefix.length, moduleName.length - matchedPattern.suffix.length);
    const matchedPatternText = typeof matchedPattern === "string" ? matchedPattern : `${matchedPattern.prefix}*${matchedPattern.suffix}`;

    for (const it of this.paths[matchedPatternText]) {
      const candidate = matchedStar ? it.replace("*", matchedStar) : it;
      const fullPath = path.resolve(this.baseUrl, candidate);

      // TODO: currently it resolves the first substitution, this is not right
      return this.getRelativePath(fileName, fullPath);
    }

    return undefined;
  }

  private parsePatterns(paths: ts.MapLike<string[]>): (string | Pattern)[] {
    return Object.keys(paths)
      .map(pattern => {
        const indexOfStar = pattern.indexOf("*");
        if (indexOfStar === -1) {
          return pattern;
        }

        return pattern.indexOf("*", indexOfStar + 1) !== -1
          ? undefined
          : {
            prefix: pattern.substr(0, indexOfStar),
            suffix: pattern.substr(indexOfStar + 1)
          };
      })
      .filter(it => it !== undefined) as (string | Pattern)[];
  }

  private matchPatternOrExact(candidate: string): string | Pattern | undefined {
    if (!this.patterns) return candidate;

    const patterns: Pattern[] = [];
    for (const patternOrString of this.patterns) {
      if (patternOrString === candidate) {
        return candidate;
      }

      if (typeof patternOrString !== "string") {
        patterns.push(patternOrString);
      }
    }

    return this.findBestPatternMatch(patterns, _ => _, candidate);
  }

  private findBestPatternMatch<T>(values: readonly T[], getPattern: (value: T) => Pattern, candidate: string): T | undefined {
    let matchedValue: T | undefined;
    let longestMatchPrefixLength = -1;

    for (const v of values) {
      const pattern = getPattern(v);
      if (this.isPatternMatch(pattern, candidate) && pattern.prefix.length > longestMatchPrefixLength) {
        longestMatchPrefixLength = pattern.prefix.length;
        matchedValue = v;
      }
    }

    return matchedValue;
  }

  private isPatternMatch({prefix, suffix}: Pattern, candidate: string) {
    return candidate.length >= prefix.length + suffix.length &&
      candidate.startsWith(prefix) &&
      candidate.endsWith(suffix);
  }

  private getRelativePath(fromString: string, toString: string) {
    let relativePath = path.relative(path.dirname(fromString), toString);
    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath;
    }

    relativePath = relativePath.replaceAll("\\", "/");

    return relativePath;
  }
}
