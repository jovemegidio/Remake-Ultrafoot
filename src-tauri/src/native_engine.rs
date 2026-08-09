use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionInput {
    player_id: u64,
    age: u32,
    overall: f64,
    potential: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionSeason {
    season: u32,
    age: u32,
    overall: u32,
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProjection {
    player_id: u64,
    seasons: Vec<ProjectionSeason>,
}

#[tauri::command]
pub fn project_squad(
    players: Vec<ProjectionInput>,
    start_season: u32,
    years: Option<u32>,
) -> Vec<PlayerProjection> {
    let horizon = years.unwrap_or(5).clamp(1, 10);
    players
        .into_iter()
        .map(|player| {
            let seasons = (0..horizon)
                .map(|index| {
                    let age = player.age + index;
                    let development = if age <= 23 {
                        (player.potential - player.overall)
                            .max(0.0)
                            .min(((24 - age) as f64 * 1.4) + index as f64 * 0.7)
                    } else {
                        0.0
                    };
                    let decline = if age >= 31 {
                        ((age - 30) as f64).powf(1.12)
                    } else if age >= 29 {
                        (age - 28) as f64 * 0.35
                    } else {
                        0.0
                    };
                    let overall = (player.overall + development - decline)
                        .round()
                        .clamp(35.0, player.potential) as u32;
                    let status = if age <= 23 && overall as f64 > player.overall {
                        "evolucao"
                    } else if age >= 31 && (overall as f64) < player.overall {
                        "declinio"
                    } else if (26..=30).contains(&age) {
                        "pico"
                    } else {
                        "estavel"
                    };
                    ProjectionSeason {
                        season: start_season + index,
                        age,
                        overall,
                        status,
                    }
                })
                .collect();
            PlayerProjection {
                player_id: player.player_id,
                seasons,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn jovem_evolui_e_veterano_declina() {
        let result = project_squad(
            vec![
                ProjectionInput {
                    player_id: 1,
                    age: 19,
                    overall: 68.0,
                    potential: 84.0,
                },
                ProjectionInput {
                    player_id: 2,
                    age: 33,
                    overall: 82.0,
                    potential: 82.0,
                },
            ],
            2026,
            Some(5),
        );
        assert!(result[0].seasons[4].overall > result[0].seasons[0].overall);
        assert!(result[1].seasons[4].overall < result[1].seasons[0].overall);
    }
}
