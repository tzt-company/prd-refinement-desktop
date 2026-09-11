param([string]$Title='选择主 PRD',[string]$SelectPath)
Add-Type @"
using System;using System.Text;using System.Runtime.InteropServices;
public class PickerNative {
 public delegate bool Callback(IntPtr hwnd,IntPtr param);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,Callback cb,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,uint msg,IntPtr w,StringBuilder l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,uint msg,IntPtr w,string l);
}
"@
$script:picker=[IntPtr]::Zero
[PickerNative]::EnumWindows({param($h,$p) $b=[Text.StringBuilder]::new(512);[void][PickerNative]::GetWindowText($h,$b,512);if($b.ToString() -eq $Title){$script:picker=$h};return $true},[IntPtr]::Zero)|Out-Null
if($script:picker -eq [IntPtr]::Zero){throw 'Picker not found'}
$script:controls=@()
[PickerNative]::EnumChildWindows($script:picker,{param($h,$p) $b=[Text.StringBuilder]::new(2048);$c=[Text.StringBuilder]::new(128);[void][PickerNative]::GetWindowText($h,$b,2048);[void][PickerNative]::GetClassName($h,$c,128);$script:controls += [pscustomobject]@{Handle=$h.ToInt64();Class=$c.ToString();Text=$b.ToString()};return $true},[IntPtr]::Zero)|Out-Null
$controls | Where-Object {$_.Class -match 'Edit|ComboBox|Button|Static'} | ConvertTo-Json

if($SelectPath){
 $edit=$controls | Where-Object {$_.Class -eq 'Edit'} | Select-Object -First 1
 if(!$edit){throw 'Filename edit not found'}
 [void][PickerNative]::SendMessage([IntPtr]$edit.Handle,0x000C,[IntPtr]::Zero,$SelectPath)
 $button=$controls | Where-Object {$_.Class -eq 'Button' -and $_.Text -match '打开|选择文件夹'} | Select-Object -First 1
 if(!$button){throw 'Open button not found'}
 [void][PickerNative]::SendMessage([IntPtr]$button.Handle,0x00F5,[IntPtr]::Zero,'')
}

