use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct UpdateMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id,
        constraint = market.authority == authority.key()
    )]
    pub market: Account<'info, Market>,
}

impl<'info> UpdateMetadata<'info> {
    pub fn handler(&mut self, _market_id: u32, new_metadata_url: String) -> Result<()> {
        require!(
            new_metadata_url.len() <= 200,
            PredictionMarketError::InvalidMetadata
        );

        self.market.meta_data_url = new_metadata_url.clone();

        let market_id_val = self.market.market_id;
        let authority_key = self.authority.key();

        msg!("Market metadata updated to: {}", new_metadata_url);

        emit!(MetadataUpdated {
            market_id: market_id_val,
            authority: authority_key,
            new_metadata_url,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
