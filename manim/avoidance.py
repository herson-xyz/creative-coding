# Render:
#   manim -pql manim/avoidance.py AvoidanceBehavior   # low quality preview
#   manim -pqh manim/avoidance.py AvoidanceBehavior   # high quality

from manim import *
import numpy as np

BG         = "#080808"
C_FOCAL    = "#cc88ff"  # focal agent
C_NEIGHBOR = "#44ff44"  # inside radius
C_OUTSIDE  = "#2a2a2a"  # outside radius
C_VECTOR   = "#ff9966"  # repulsion arrows
C_SUM      = "#ffdd44"  # avoidV resultant
C_VELOCITY = "#44aaff"  # velocity arrow
C_CODE     = "#777777"  # code annotations


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def vec_sum(vecs):
    result = np.zeros(3)
    for v in vecs:
        result = result + np.array(v)
    return result


def code_label(text, size=16, color=C_CODE):
    return Text(text, font_size=size, color=color)


class AvoidanceBehavior(Scene):
    """
    Visualises the avoidance pass from agents.wgsl, step by step:

        var avoidV = vec2(0.0);
        for (var i = 0u; i < count; i++) {
            if (i == id.x) { continue; }
            var other = positions[i];
            var d = distance(other, p);
            if (d < 10) { avoidV += p - other; }
        }
        v += 0.08 * avoidV;
        v = normalize(v);
    """

    def construct(self):
        self.camera.background_color = BG

        focal     = ORIGIN
        RADIUS    = 1.6

        neighbors = [
            LEFT  * 1.1 + UP   * 0.5,
            RIGHT * 0.9 + DOWN * 0.6,
            UP    * 1.3 + RIGHT * 0.3,
        ]
        outsiders = [
            LEFT  * 2.8 + UP   * 1.0,
            RIGHT * 2.7 + UP   * 0.8,
            LEFT  * 2.3 + DOWN * 1.9,
            RIGHT * 2.1 + DOWN * 2.1,
            DOWN  * 2.4 + LEFT * 0.7,
        ]
        init_v = unit(RIGHT * 0.9 + UP * 0.25)

        # ── dots ────────────────────────────────────────────────
        focal_dot = Dot(focal, color=WHITE, radius=0.10)
        nbr_dots  = [Dot(p, color=WHITE, radius=0.07) for p in neighbors]
        out_dots  = [Dot(p, color=WHITE, radius=0.07) for p in outsiders]

        title = Text("avoidance", font_size=30, color=C_FOCAL).to_corner(UL, buff=0.5)

        # ── 1. intro ─────────────────────────────────────────────
        self.play(FadeIn(title))
        self.play(
            LaggedStart(
                *[FadeIn(d) for d in [focal_dot] + nbr_dots + out_dots],
                lag_ratio=0.08,
            ),
            run_time=1.0,
        )
        self.wait(0.5)

        # ── 2. identify focal agent ──────────────────────────────
        id_label = Text("agent  id.x", font_size=14, color=C_FOCAL)\
            .next_to(focal_dot, DOWN, buff=0.28)

        self.play(
            focal_dot.animate.set_color(C_FOCAL).scale(1.5),
            FadeIn(id_label),
            run_time=0.6,
        )
        self.wait(0.4)

        # ── 3. interaction radius ────────────────────────────────
        ring = Circle(
            radius=RADIUS, color=C_FOCAL,
            stroke_opacity=0.35, stroke_width=1.5,
        ).move_to(focal)

        d_label = code_label("if (d < 10)", size=14, color=C_FOCAL)\
            .next_to(ring.get_right(), UP, buff=0.15).shift(RIGHT * 0.05)

        self.play(Create(ring), FadeIn(d_label), run_time=0.8)
        self.wait(0.5)

        # ── 4. classify: neighbors vs outsiders ─────────────────
        self.play(
            *[d.animate.set_color(C_NEIGHBOR) for d in nbr_dots],
            *[d.animate.set_color(C_OUTSIDE)  for d in out_dots],
            run_time=0.7,
        )

        skip_note = Text("skip self  (i == id.x)", font_size=12, color=C_OUTSIDE)\
            .next_to(id_label, DOWN, buff=0.12)
        self.play(FadeIn(skip_note), run_time=0.4)
        self.wait(0.5)

        # ── 5. repulsion vectors  (p − other) ───────────────────
        code_a = code_label("avoidV += p − other").to_corner(DR, buff=0.5)
        self.play(FadeIn(code_a), run_time=0.4)

        rep_arrows = []
        for nbr in neighbors:
            direction = unit(focal - nbr)           # p − other, normalised for display
            arrow = Arrow(
                focal, focal + direction * 0.85,
                color=C_VECTOR, buff=0,
                stroke_width=2.5, tip_length=0.17,
                max_stroke_width_to_length_ratio=10,
            )
            rep_arrows.append(arrow)
            self.play(GrowArrow(arrow), run_time=0.4)

        self.wait(0.5)

        # ── 6. avoidV — sum of repulsion vectors ────────────────
        avoid_raw  = vec_sum([focal - nbr for nbr in neighbors])
        avoid_dir  = unit(avoid_raw)

        avoid_arrow = Arrow(
            focal, focal + avoid_dir * 1.1,
            color=C_SUM, buff=0, stroke_width=3, tip_length=0.2,
        )
        avoid_label = Text("avoidV", font_size=14, color=C_SUM)\
            .next_to(focal + avoid_dir * 1.1, RIGHT, buff=0.12)

        self.play(
            *[FadeOut(a) for a in rep_arrows],
            GrowArrow(avoid_arrow),
            FadeIn(avoid_label),
            run_time=0.7,
        )
        self.wait(0.5)

        # ── 7. v += 0.08 * avoidV ───────────────────────────────
        code_b = code_label("v += 0.08 * avoidV").to_corner(DR, buff=0.5)
        self.play(FadeOut(code_a), FadeIn(code_b), run_time=0.3)

        v_arrow = Arrow(
            focal, focal + init_v,
            color=C_VELOCITY, buff=0, stroke_width=3, tip_length=0.2,
        )
        v_label = Text("v", font_size=15, color=C_VELOCITY)\
            .next_to(focal + init_v, UP, buff=0.1)

        self.play(GrowArrow(v_arrow), FadeIn(v_label), run_time=0.5)
        self.wait(0.3)

        blended_v     = init_v + avoid_dir * 0.45
        blended_arrow = Arrow(
            focal, focal + blended_v,
            color=C_VELOCITY, buff=0, stroke_width=3, tip_length=0.2,
        )
        self.play(
            Transform(v_arrow, blended_arrow),
            FadeOut(v_label),
            run_time=0.7,
        )
        self.wait(0.5)

        # ── 8. normalize — direction only, speed constant ────────
        code_c = code_label("v = normalize(v)").to_corner(DR, buff=0.5)
        self.play(FadeOut(code_b), FadeIn(code_c), run_time=0.3)

        norm_v      = unit(blended_v)
        norm_arrow  = Arrow(
            focal, focal + norm_v,
            color=C_VELOCITY, buff=0, stroke_width=3, tip_length=0.2,
        )
        unit_ring   = Circle(
            radius=1.0, color=C_VELOCITY,
            stroke_opacity=0.2, stroke_width=1,
        )
        speed_label = Text("‖v‖ = 1  — speed invariant", font_size=13, color=C_VELOCITY)\
            .next_to(unit_ring, DOWN, buff=0.15)

        self.play(
            Transform(v_arrow, norm_arrow),
            Create(unit_ring),
            run_time=0.8,
        )
        self.play(FadeIn(speed_label), run_time=0.4)
        self.wait(1.8)

        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.9)
