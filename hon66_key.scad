// HON66 key model
// Datum: midpoint of the left edge of the key profile.

$fn = 64;

inch = 25.4;

key_length = 1.834 * inch;
key_height = 0.311 * inch;
key_width = 3;
tip_chamfer = 0.106 * inch;
web_thickness = 0.015 * inch;
tip_profile_half_height = 0.0315 * inch / 2;
long_edge_chamfer = 1.0;
left_profile_width = 7;
left_profile_height = 10;
bottom_notch_depth = 3.2;
bottom_notch_right_from_tip = 41.2;

cut_a = [2, 3, 4, 5, 6, 1];
cut_b = [6, 5, 4, 3, 2, 1];
cut_spacing = 0.120 * inch;
first_cut_from_right = 0.746 * inch;
cut1_depth = 0.042 * inch;
cut_step = 0.014 * inch;
cut_land = 1;
lead_in_land = 4;

function cut_x(index) = key_length - first_cut_from_right + (index * cut_spacing);
function cut_depth(cut) = cut1_depth + ((cut - 1) * cut_step);
function top_cut_y(cut) = key_height / 2 - cut_depth(cut);
function bottom_cut_y(cut) = -key_height / 2 + cut_depth(cut);
function first_regular_land_start() = cut_x(0) - cut_land / 2;
function starts_land(cuts, index) = index == 0 || cuts[index] != cuts[index - 1];
function ends_land(cuts, index) = index == len(cuts) - 1 || cuts[index] != cuts[index + 1];
function bottom_first_ramp_start(cuts) = first_regular_land_start() - abs(bottom_cut_y(cuts[0]) - bottom_cut_y(1));
function bottom_depth1_ramp_end(cuts) = bottom_first_ramp_start(cuts) - lead_in_land;
function bottom_full_ramp_start(cuts) = bottom_depth1_ramp_end(cuts) - abs(bottom_cut_y(1) - (-key_height / 2));
function top_first_ramp_start(cuts) = first_regular_land_start() - abs(top_cut_y(cuts[0]) - top_cut_y(1));
function top_depth1_ramp_end(cuts) = top_first_ramp_start(cuts) - lead_in_land;
function top_full_ramp_start(cuts) = top_depth1_ramp_end(cuts) - abs((key_height / 2) - top_cut_y(1));

function bottom_lead_in_points(cuts) = [
    [bottom_full_ramp_start(cuts), -key_height / 2],
    [bottom_depth1_ramp_end(cuts), bottom_cut_y(1)],
    [bottom_first_ramp_start(cuts), bottom_cut_y(1)]
];

function top_lead_in_points(cuts) = [
    [top_first_ramp_start(cuts), top_cut_y(1)],
    [top_depth1_ramp_end(cuts), top_cut_y(1)],
    [top_full_ramp_start(cuts), key_height / 2]
];

function top_cut_points(cuts) = [
    for (i = [0 : len(cuts) - 1], point = concat(
        starts_land(cuts, i) ? [[cut_x(i) - cut_land / 2, top_cut_y(cuts[i])]] : [],
        ends_land(cuts, i) ? [[cut_x(i) + cut_land / 2, top_cut_y(cuts[i])]] : []
    ))
        point
];

function bottom_cut_points(cuts) = [
    for (i = [0 : len(cuts) - 1], point = concat(
        starts_land(cuts, i) ? [[cut_x(i) - cut_land / 2, bottom_cut_y(cuts[i])]] : [],
        ends_land(cuts, i) ? [[cut_x(i) + cut_land / 2, bottom_cut_y(cuts[i])]] : []
    ))
        point
];

function reversed_top_cut_points(cuts) = [
    for (i = [len(cuts) - 1 : -1 : 0], point = concat(
        ends_land(cuts, i) ? [[cut_x(i) + cut_land / 2, top_cut_y(cuts[i])]] : [],
        starts_land(cuts, i) ? [[cut_x(i) - cut_land / 2, top_cut_y(cuts[i])]] : []
    ))
        point
];

module left_profile_extension_2d() {
    translate([-left_profile_width, key_height / 2 - left_profile_height])
        square([left_profile_width, left_profile_height]);
}

module key_outline_2d() {
    polygon([
        [0, -key_height / 2],
        [key_length - tip_chamfer, -key_height / 2],
        [key_length, -key_height / 2 + tip_chamfer],
        [key_length, key_height / 2 - tip_chamfer],
        [key_length - tip_chamfer, key_height / 2],
        [0, key_height / 2]
    ]);
}

module key_profile_2d() {
    polygon(concat(
        [
            [0, -key_height / 2]
        ],
        bottom_lead_in_points(cut_b),
        bottom_cut_points(cut_b),
        [
            [key_length, -tip_profile_half_height],
            [key_length, tip_profile_half_height]
        ],
        reversed_top_cut_points(cut_a),
        top_lead_in_points(cut_a),
        [
            [0, key_height / 2]
        ]
    ));
}

module key_blank_half_3d() {
    union() {
        linear_extrude(height = web_thickness)
            key_outline_2d();

        translate([0, 0, web_thickness])
            linear_extrude(height = key_width / 2 - web_thickness)
                key_profile_2d();
    }
}

module key_blank_3d() {
    union() {
        key_blank_half_3d();

        rotate([180, 0, 0])
            key_blank_half_3d();
    }
}

module left_profile_extension_3d() {
    translate([0, 0, -key_width / 2])
        linear_extrude(height = key_width)
            left_profile_extension_2d();
}

module key_with_left_profile_3d() {
    union() {
        key_blank_3d();
        left_profile_extension_3d();
    }
}

module positive_yz_chamfer_cutter() {
    x_margin = 1;
    cutter_overlap = 0.1;
    y_outer = key_height / 2;
    z_outer = key_width / 2;

    polyhedron(
        points = [
            [-x_margin, y_outer + cutter_overlap, z_outer + cutter_overlap],
            [-x_margin, y_outer - long_edge_chamfer, z_outer + cutter_overlap],
            [-x_margin, y_outer + cutter_overlap, z_outer - long_edge_chamfer],
            [key_length + x_margin, y_outer + cutter_overlap, z_outer + cutter_overlap],
            [key_length + x_margin, y_outer - long_edge_chamfer, z_outer + cutter_overlap],
            [key_length + x_margin, y_outer + cutter_overlap, z_outer - long_edge_chamfer]
        ],
        faces = [
            [0, 2, 1],
            [3, 4, 5],
            [0, 1, 4, 3],
            [1, 2, 5, 4],
            [2, 0, 3, 5]
        ]
    );
}

module bottom_profile_notch_cutter() {
    cutter_overlap = 0.1;
    x_start = 0;
    y_start = -key_height / 2;
    x_ramp_end = x_start + bottom_notch_depth;
    y_notch = y_start + bottom_notch_depth;
    x_square_edge = key_length - bottom_notch_right_from_tip;
    y_exit = y_start - left_profile_height - cutter_overlap;

    translate([0, 0, -key_width / 2 - cutter_overlap])
        linear_extrude(height = key_width + (2 * cutter_overlap))
            polygon([
                [x_start, y_start],
                [x_ramp_end, y_notch],
                [x_square_edge, y_notch],
                [x_square_edge, y_exit],
                [x_start, y_exit]
            ]);
}

module hon66_key() {
    difference() {
        key_with_left_profile_3d();
        positive_yz_chamfer_cutter();
        bottom_profile_notch_cutter();
    }
}

hon66_key();
