// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createZipArchive } from "./zip";

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function readString(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

describe("createZipArchive", () => {
  it("writes a zip archive with the export root path prefixed into each entry", () => {
    const archive = createZipArchive(
      {
        "COMPANY.md": "# Company\n",
        "agents/ceo/AGENTS.md": "# CEO\n",
      },
      "paperclip-demo",
    );

    expect(readUint32(archive, 0)).toBe(0x04034b50);

    const firstNameLength = readUint16(archive, 26);
    const firstBodyLength = readUint32(archive, 18);
    expect(readString(archive, 30, firstNameLength)).toBe("paperclip-demo/agents/ceo/AGENTS.md");
    expect(readString(archive, 30 + firstNameLength, firstBodyLength)).toBe("# CEO\n");

    const secondOffset = 30 + firstNameLength + firstBodyLength;
    expect(readUint32(archive, secondOffset)).toBe(0x04034b50);

    const secondNameLength = readUint16(archive, secondOffset + 26);
    const secondBodyLength = readUint32(archive, secondOffset + 18);
    expect(readString(archive, secondOffset + 30, secondNameLength)).toBe("paperclip-demo/COMPANY.md");
    expect(readString(archive, secondOffset + 30 + secondNameLength, secondBodyLength)).toBe("# Company\n");

    const endOffset = archive.length - 22;
    expect(readUint32(archive, endOffset)).toBe(0x06054b50);
    expect(readUint16(archive, endOffset + 8)).toBe(2);
    expect(readUint16(archive, endOffset + 10)).toBe(2);
  });
});
