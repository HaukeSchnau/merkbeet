"""Rechnet die aus der Skizze abgelesenen Pixelpositionen in Weltmeter um.

Nur zur Nachvollziehbarkeit -- das Ergebnis ist nach src/garden/plan.ts kopiert.
Referenzbild: docs/reference/garden-sketch.jpg, um -90 Grad gedreht (1280x960).
"""

# Kalibrierung in Pixeln des gedrehten Referenzbildes.
PX_WEST, PX_EAST = 200.0, 1103.0        # West- und Ostkante des Beetes
BED_LENGTH_M = 19.50                     # beschriftetes Mass
SKEW = -0.019                            # Papier liegt ~1 Grad schief

PX_PER_M = (PX_EAST - PX_WEST) / BED_LENGTH_M

TERRACE_DEPTH_M = 5.30                   # 7.60 (Westarm) - 2.30 (Suedarm)
SOUTH_DEPTH_M = 2.30

def y_north(px):   return 443.0 + SKEW * (px - 200.0)   # Nordkante Beet/Terrasse
def y_mid(px):     return 642.0 + SKEW * (px - 316.0)   # Terrassen-/Hauskante
def y_south(px):   return 752.0 + SKEW * (px - 215.0)   # Suedkante Beet

def to_world(px, py):
    x = (px - PX_WEST) / PX_PER_M
    if py <= y_mid(px):
        top, bot, y0, span = y_north(px), y_mid(px), 0.0, TERRACE_DEPTH_M
    else:
        top, bot, y0, span = y_mid(px), y_south(px), TERRACE_DEPTH_M, SOUTH_DEPTH_M
    y = y0 + (py - top) / (bot - top) * span
    return round(x, 2), round(y, 2)

# (id, Art, Pixelposition, Durchmesser in m) -- Reihenfolge wie auf der Skizze
PLANTS = [
    # Westarm, von Nord nach Sued
    ("rose-w1",        "rose",        (246, 486), 0.9),
    ("lavender-w1",     "lavender",    (289, 498), 0.6),
    ("rose-w2",        "rose",        (289, 546), 0.9),
    ("grass-w1",       "grass",       (296, 581), 0.8),
    ("buddleia-w1",    "buddleia",    (251, 596), 1.8),
    ("viburnum-w1",    "viburnum",    (294, 626), 1.0),
    ("magnolia-c1",    "magnolia",    (291, 690), 2.2),
    # Suedarm, von West nach Ost
    ("hydrangea-s1",   "hydrangea",   (394, 669), 1.1),
    ("spiraea-s1",     "spiraea",     (372, 722), 1.0),
    ("rose-s1",        "rose",        (421, 723), 0.9),
    ("buddleia-s1",    "buddleia",    (490, 659), 1.2),
    ("photinia-s1",    "photinia",    (472, 695), 1.3),
    ("lavender-s1",    "lavender",    (470, 738), 0.6),
    ("rose-s2",        "rose",        (521, 722), 0.9),
    ("hydrangea-s2",   "hydrangea",   (550, 676), 1.1),
    ("spiraea-s2",     "spiraea",     (589, 730), 1.0),
    ("kilimanjaro-s1", "kilimanjaro", (633, 700), 2.0),
    ("laurel-s1",      "laurel",      (710, 669), 1.3),
    ("lavender-s2",    "lavender",    (690, 733), 0.6),
    ("rose-s3",        "rose",        (734, 714), 0.9),
    ("hydrangea-s3",   "hydrangea",   (790, 691), 1.1),
    ("spiraea-s3",     "spiraea",     (860, 722), 1.0),
    ("rose-s4",        "rose",        (932, 676), 0.9),
    ("photinia-s2",    "photinia",    (1017, 662), 1.3),
    ("hydrangea-s4",   "hydrangea",   (1067, 669), 1.1),
]

print(f"// px/m = {PX_PER_M:.2f}")
for pid, species, (px, py), dia in PLANTS:
    x, y = to_world(px, py)
    print(f'  {{ id: "{pid}", speciesId: "{species}", position: {{ x: {x}, y: {y} }}, diameterMeters: {dia} }},')
