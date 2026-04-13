param([string]$File)
$m = @{
  '#059669'='var(--nx-success-dark)';'#10b981'='var(--nx-success)';'#ecfdf5'='var(--nx-success-light)'
  '#6ee7b7'='var(--nx-success-light2)';'#065f46'='var(--nx-success-darker)';'#064e3b'='var(--nx-success-darkest)'
  '#bbf7d0'='var(--nx-success-light3)';'#f0fdf4'='var(--nx-success-light4)'
  '#f59e0b'='var(--nx-warning)';'#fffbeb'='var(--nx-warning-light)';'#d97706'='var(--nx-warning-dark)'
  '#92400e'='var(--nx-warning-darker)';'#78350f'='var(--nx-warning-darkest)'
  '#fcd34d'='var(--nx-warning-light2)';'#fbbf24'='var(--nx-warning-light3)'
  '#dc2626'='var(--nx-priority-critical)';'#ef4444'='var(--nx-danger)';'#991b1b'='var(--nx-danger-darker)'
  '#7f1d1d'='var(--nx-danger-darkest)';'#450a0a'='var(--nx-danger-extreme)'
  '#fca5a5'='var(--nx-danger-light2)';'#f87171'='var(--nx-danger-light3)'
  '#fee2e2'='var(--nx-danger-light4)';'#fef2f2'='var(--nx-danger-light)'
  '#3b82f6'='var(--nx-info)';'#eff6ff'='var(--nx-info-light)';'#2563eb'='var(--nx-info-dark)'
  '#1d4ed8'='var(--nx-info-darker)';'#93c5fd'='var(--nx-info-light2)'
  '#8b5cf6'='var(--nx-purple)';'#f5f3ff'='var(--nx-purple-light)';'#7c3aed'='var(--nx-purple-dark)'
  '#6d28d9'='var(--nx-purple-darker)';'#5b21b6'='var(--nx-purple-darkest)';'#c4b5fd'='var(--nx-purple-light2)'
  '#f97316'='var(--nx-orange)';'#fff7ed'='var(--nx-orange-light)';'#fdba74'='var(--nx-orange-light2)'
  '#431407'='var(--nx-orange-extreme1)';'#422006'='var(--nx-orange-extreme2)';'#451a03'='var(--nx-orange-extreme3)'
  '#6b7280'='var(--nx-status-closed)';'#94a3b8'='var(--nx-muted)'
  '#64748b'='var(--nx-text-secondary)';'#475569'='var(--nx-text-secondary)'
  '#6366f1'='var(--nx-primary)';'#4f46e5'='var(--nx-primary-hover)'
  '#e2e8f0'='var(--nx-border)';'#cbd5e1'='var(--nx-border-strong)'
  '#e0e7ff'='var(--nx-primary-100)';'#c7d2fe'='var(--nx-primary-200)'
  '#a5b4fc'='var(--nx-primary-300)';'#818cf8'='var(--nx-primary-400)'
  '#3730a3'='var(--nx-primary-800)';'#312e81'='var(--nx-primary-900)'
  '#1e293b'='var(--nx-surface-dark)';'#334155'='var(--nx-gray-700)'
  '#fef3c7'='var(--nx-warning-amber100)';'#1e40af'='var(--nx-info-dark2)'
  '#dbeafe'='var(--nx-info-light3)';'#fecaca'='var(--nx-danger-light5)'
  '#fb923c'='var(--nx-orange-400)';'#ea580c'='var(--nx-orange-600)'
}
$c = [IO.File]::ReadAllText($File)
$b = ([regex]::Matches($c,'#[0-9a-fA-F]{3,8}(?!\w)')).Count
foreach ($hex in $m.Keys) {
  $c = $c -replace "(?i)$([regex]::Escape($hex))(?![0-9a-fA-F])",$m[$hex]
}
$a = ([regex]::Matches($c,'#[0-9a-fA-F]{3,8}(?!\w)')).Count
[IO.File]::WriteAllText($File,$c,[System.Text.Encoding]::UTF8)
Write-Output "$([IO.Path]::GetFileName($File).PadRight(32)) $b->$a  (-$($b-$a))"
