import { describe, expect, it } from "vitest";
import {
  createThemeArchiveStore,
  decodeThemeArchive,
  encodeThemeArchive,
  THEME_ARCHIVE_KIND,
  THEME_ARCHIVE_MAGIC,
  THEME_ARCHIVE_VERSION
} from "../src/modules/appearance/domain/archive.js";

const definition = {
  id: "studio",
  label: "Studio",
  note: "测试主题",
  preview: { canvas: "#faf9f2", paper: "#ffffff", accent: "#f4d35e", line: "#a8d94e" },
  captions: { light: "", dark: "" },
  tokens: { light: { "--accent": "#f4d35e" }, dark: { "--accent": "#e8c65a" } },
  fixedScheme: ""
};

function payload() {
  return {
    kind: THEME_ARCHIVE_KIND,
    version: THEME_ARCHIVE_VERSION,
    savedAt: 1,
    files: [{
      path: "themes/studio.theme.json",
      id: "studio",
      source: "user",
      raw: null,
      definition
    }]
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

describe("自制主题包", () => {
  it("编码后带自定义魔数，并可 gzip/校验往返", async () => {
    const bytes = await encodeThemeArchive(payload());
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe(THEME_ARCHIVE_MAGIC);
    await expect(decodeThemeArchive(bytes)).resolves.toMatchObject({
      kind: THEME_ARCHIVE_KIND,
      version: THEME_ARCHIVE_VERSION,
      files: [{ id: "studio", path: "themes/studio.theme.json" }]
    });
  });

  it("仍可读取改名前导出的主题归档", async () => {
    const legacy = { ...payload(), kind: "tribblebook-theme-bundle" };
    const restored = await decodeThemeArchive(await encodeThemeArchive(legacy));
    expect(restored.kind).toBe("tribblebook-theme-bundle");
    expect(restored.files[0].id).toBe("studio");
  });

  it("拒绝被篡改的内容与不安全主题文件路径", async () => {
    const bytes = await encodeThemeArchive(payload());
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(decodeThemeArchive(tampered)).rejects.toThrow();
    await expect(encodeThemeArchive({
      ...payload(),
      files: [{ ...payload().files[0], path: "../escape.json" }]
    })).rejects.toThrow("不安全文件路径");
    await expect(encodeThemeArchive({
      ...payload(),
      files: [payload().files[0], { ...payload().files[0] }]
    })).rejects.toThrow("重复主题");
    await expect(encodeThemeArchive({
      ...payload(),
      files: [{ ...payload().files[0], definition: { id: "studio" } }]
    })).rejects.toThrow("定义无效");
  });

  it("v3 往返保留删除墓碑 removedIds，旧 v2 档案补默认空数组", async () => {
    const withTombstones = { ...payload(), removedIds: ["seaside", "night-orchard"] };
    const restored = await decodeThemeArchive(await encodeThemeArchive(withTombstones));
    expect(restored.removedIds).toEqual(["seaside", "night-orchard"]);

    const v2payload = { ...payload(), version: 2 };
    const v2bytes = await encodeThemeArchive(v2payload);
    const view = new DataView(v2bytes.buffer, v2bytes.byteOffset, v2bytes.byteLength);
    view.setUint16(8, 2, true); // 旧版应用的档案头
    const oldVersion = await decodeThemeArchive(v2bytes);
    expect(oldVersion.version).toBe(2);
    expect(oldVersion.removedIds).toEqual([]);
  });

  it("拒绝非法 removedIds（非数组 / 非法 ID / 超限）", async () => {
    await expect(encodeThemeArchive({ ...payload(), removedIds: "seaside" })).rejects.toThrow(/必须是数组/);
    await expect(encodeThemeArchive({ ...payload(), removedIds: ["Bad-ID"] })).rejects.toThrow(/非法主题 ID/);
    await expect(encodeThemeArchive({ ...payload(), removedIds: ["seaside", 42] })).rejects.toThrow(/非法主题 ID/);
    const overload = Array.from({ length: 129 }, (_, index) => `t-${index}`);
    await expect(encodeThemeArchive({ ...payload(), removedIds: overload })).rejects.toThrow(/不能超过/);
  });

  it("在没有 Electron 桥接时使用同一格式的 localStorage 回退", async () => {
    const storage = memoryStorage();
    const archive = createThemeArchiveStore(storage);
    const location = await archive.save(payload());
    // 持久化键作为升级兼容协议保留旧命名空间。
    expect(location).toContain("tribblebook-theme-bundle-v1");
    const restored = await archive.load();
    expect(restored.payload.files[0].definition.label).toBe("Studio");
    await archive.remove();
    expect((await archive.load()).payload).toBeNull();
  });
});
