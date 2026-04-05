use crate::constants::*;
use crate::error::*;
use crate::events::*;
use crate::state::{Market, UserStats};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, MintTo, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct SplitToken<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.market_id == market_id
    )]
    pub market: Box<Account<'info, Market>>,
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = outcome_yes_mint.key() == market.outcome_yes_mint
    )]
    pub outcome_yes_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        constraint = outcome_no_mint.key() == market.outcome_no_mint
    )]
    pub outcome_no_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = outcome_yes_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_outcome_yes: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = outcome_no_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_outcome_no: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStats::INIT_SPACE,
        seeds = [USER_STATS_SEED, market_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_stats_account: Box<Account<'info, UserStats>>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> SplitToken<'info> {
    pub fn split_token(
        &mut self,
        market_id: u32,
        amount: u64,
        bumps: &SplitTokenBumps,
    ) -> Result<()> {
        require!(amount > 0, PredictionMarketError::InvalidAmount);
        require!(
            !self.market.is_settled,
            PredictionMarketError::MarketAlreadySettled
        );
        require!(
            Clock::get()?.unix_timestamp < self.market.settlement_deadline,
            PredictionMarketError::MarketExpired
        );

        // Transferring the tokens from user account into Collateral Vault
        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.user_collateral.to_account_info(),
                    to: self.collateral_vault.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let market_id_bytes = self.market.market_id.to_le_bytes();
        let market_bump = self.market.bump;
        let seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[market_bump]];

        // Minting Outcome Tokens
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.outcome_yes_mint.to_account_info(),
                    to: self.user_outcome_yes.to_account_info(),
                    authority: self.market.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.outcome_no_mint.to_account_info(),
                    to: self.user_outcome_no.to_account_info(),
                    authority: self.market.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        self.market.total_collateral_locked = self
            .market
            .total_collateral_locked
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let user_stats = &mut self.user_stats_account;
        if user_stats.user == Pubkey::default() {
            user_stats.user = self.user.key();
            user_stats.market_id = market_id;
            user_stats.locked_yes = 0;
            user_stats.claimable_yes = 0;
            user_stats.locked_no = 0;
            user_stats.claimable_no = 0;
            user_stats.locked_collateral = 0;
            user_stats.claimable_collateral = 0;
            user_stats.reward_claimed = false;
            user_stats.bump = bumps.user_stats_account;
        }

        msg!("Minted {} outcome tokens for user", amount);

        emit!(TokensSplit {
            market_id,
            user: self.user.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
