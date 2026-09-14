# Round 2：v0.1.4 发布与资产回查

日期：2026-09-14

## PASS 证据

- annotated tag `v0.1.4` 指向源码 `7bd60422eb95ffd563cf49c33c0d10ec987f57af`。
- GitHub Actions run `34800014202` attempt 2 最终结论为 `success`：Windows、macOS、Release 三个 job 全部成功。
- attempt 1 的 macOS `npm ci` 因 registry `ECONNRESET` 失败；同一 tag 与源码只重跑失败 job后依赖安装、203 个测试、构建和上传通过，判定为外部瞬时网络故障。
- GitHub Release `v0.1.4` 为非 draft、非 prerelease，发布于 2026-09-14 02:47:30 UTC。
- Release 共 5 个资产：Windows 安装版、Windows 便携版、macOS DMG、macOS ZIP、`SHA256SUMS.txt`。
- 已下载 `SHA256SUMS.txt`；其中 4 个安装包 SHA-256 与 GitHub 服务端 asset digest 逐项一致。

## 资产哈希

| 文件 | Bytes | SHA-256 |
| --- | ---: | --- |
| `prd-refinement-desktop-setup-0.1.4-x64.exe` | 102633681 | `3361518251bc8cd35e8112b911628c64dd41ceafa2a700f95910df52f29b65b2` |
| `prd-refinement-desktop-portable-0.1.4-x64.exe` | 102403930 | `a12ab745235ac0d6c14ed838f11129964e4a548e2aec504129354bbdfa4d3d00` |
| `prd-refinement-desktop-0.1.4-arm64.dmg` | 130938493 | `5acc1c797327147f68d11d912e799cd4dc491667554adf2ed6572cc8f763e37e` |
| `prd-refinement-desktop-0.1.4-arm64.zip` | 131008682 | `c0acd90503e6d54362a323557841c4e7f4f918614440d0dae236f24cb73154da` |
| `SHA256SUMS.txt` | 431 | `3fec7e746806dcc7540e6fa9954ac0b75f1141b6bb6a6e4bac20e261832263b0` |
